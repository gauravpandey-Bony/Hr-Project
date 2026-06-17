"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  extractNovaVoiceCommand,
  isDirectNovaIntent,
  normalizeNovaVoiceMessage,
  parseNovaMessage,
  transcriptHasWakeWord,
  NOVA,
} from "@/lib/ai/nova-assistant";
import {
  claimSpeechRecognition,
  ensureMicrophoneAccess,
  isTransientSpeechError,
  microphonePermissionGranted,
  releaseSpeechRecognition,
  speechErrorMessage,
  waitBeforeSpeechStart,
} from "@/lib/speech-recognition";
import { unlockNovaVoice } from "@/lib/nova-voice";

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: { isFinal: boolean; [i: number]: { transcript: string } };
};

const COMMAND_SILENCE_MS = 3200;
const RESTART_MS = 600;
const WAKE_COOLDOWN_MS = 2000;
const TRANSIENT_ERROR_SHOW_AFTER = 2;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function fullSessionTranscript(event: SpeechRecognitionEvent): string {
  let t = "";
  for (let i = 0; i < event.results.length; i++) {
    t += event.results[i][0]?.transcript ?? "";
  }
  return t.trim();
}

function hasFinalResult(event: SpeechRecognitionEvent): boolean {
  for (let i = event.resultIndex; i < event.results.length; i++) {
    if (event.results[i].isFinal) return true;
  }
  return false;
}

export type NovaWakePhase = "off" | "standby" | "awakened";

const HEY_NOVA_STORAGE = "nova-hey-enabled";
const MIC_READY_STORAGE = "nova-mic-ready";

export function isWakeSupported(): boolean {
  return getSpeechRecognition() !== null;
}

export function getHeyNovaEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(HEY_NOVA_STORAGE) === "true";
}

export function setHeyNovaEnabled(value: boolean) {
  localStorage.setItem(HEY_NOVA_STORAGE, value ? "true" : "false");
}

export function getMicReadyStored(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(MIC_READY_STORAGE) === "true";
}

export function setMicReadyStored(value: boolean) {
  sessionStorage.setItem(MIC_READY_STORAGE, value ? "true" : "false");
}

export function useNovaWake({
  enabled,
  onActivate,
  onCommand,
  onTranscript,
  paused = false,
  lang = "en-IN",
}: {
  enabled: boolean;
  onActivate: () => void;
  onCommand: (message: string) => void;
  /** Live speech-to-text for the input box */
  onTranscript?: (text: string) => void;
  paused?: boolean;
  lang?: string;
}) {
  const [phase, setPhase] = useState<NovaWakePhase>("off");
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState("");

  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const enabledRef = useRef(enabled);
  const pausedRef = useRef(paused);
  const phaseRef = useRef<NovaWakePhase>("off");
  const commandBufRef = useRef("");
  const busyRef = useRef(false);
  const listeningRef = useRef(false);
  const startingRef = useRef(false);
  const micGrantedRef = useRef(false);
  const transientFailRef = useRef(0);
  const lastWakeAtRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onActivateRef = useRef(onActivate);
  const onCommandRef = useRef(onCommand);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onActivateRef.current = onActivate;
    onCommandRef.current = onCommand;
    onTranscriptRef.current = onTranscript;
  }, [onActivate, onCommand, onTranscript]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
  }, []);

  const clearTimers = () => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    restartTimerRef.current = null;
    silenceTimerRef.current = null;
  };

  const setPhaseSafe = (p: NovaWakePhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const beginRecognitionRef = useRef<() => void>(() => {});

  const scheduleRestart = useCallback((delay = RESTART_MS) => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (enabledRef.current && !pausedRef.current && !busyRef.current) {
        beginRecognitionRef.current();
      }
    }, delay);
  }, []);

  const dispatchCommand = useCallback(
    (raw: string) => {
      const msg = normalizeNovaVoiceMessage(raw);
      const parsed = parseNovaMessage(msg);
      if (parsed.activationOnly) {
        onActivateRef.current();
        return;
      }
      if (!msg.trim() || busyRef.current) return;

      busyRef.current = true;
      clearTimers();
      try {
        recRef.current?.stop();
      } catch {
        try {
          recRef.current?.abort();
        } catch {
          /* ignore */
        }
      }
      listeningRef.current = false;
      releaseSpeechRecognition("wake");
      setPhaseSafe("off");
      commandBufRef.current = "";
      onCommandRef.current(msg);

      setTimeout(() => {
        busyRef.current = false;
        if (enabledRef.current && !pausedRef.current) {
          setPhaseSafe("standby");
          scheduleRestart(400);
        }
      }, 800);
    },
    [scheduleRestart]
  );

  const resetAwakenedSilence = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      const cmd = commandBufRef.current.trim();
      if (cmd) dispatchCommand(cmd.includes(NOVA.name) ? cmd : `${NOVA.name}, ${cmd}`);
      else {
        setPhaseSafe("standby");
        commandBufRef.current = "";
        scheduleRestart(0);
      }
    }, COMMAND_SILENCE_MS);
  }, [dispatchCommand, scheduleRestart]);

  const triggerWake = useCallback(() => {
    const now = Date.now();
    if (now - lastWakeAtRef.current < WAKE_COOLDOWN_MS) return;
    lastWakeAtRef.current = now;
    setPhaseSafe("awakened");
    commandBufRef.current = "";
    onActivateRef.current();
    resetAwakenedSilence();
  }, [resetAwakenedSilence]);

  const processText = useCallback(
    (sessionFull: string, isFinal: boolean) => {
      if (!sessionFull) return;
      if (pausedRef.current || busyRef.current) return;

      setLastHeard(sessionFull.slice(-100));
      onTranscriptRef.current?.(sessionFull);

      const voice = extractNovaVoiceCommand(sessionFull);

      // Full command in one phrase: "Maya, Bhupesh Sharma report"
      if (voice && voice.command.length > 2) {
        if (isFinal || voice.command.length >= 6) {
          dispatchCommand(sessionFull);
        }
        return;
      }

      if (phaseRef.current === "awakened") {
        const plain = sessionFull
          .replace(/^(?:hey\s+)?maya[,:\s]*/i, "")
          .trim();
        if (plain.length > 2) {
          commandBufRef.current = plain;
          resetAwakenedSilence();
          if (isFinal) {
            dispatchCommand(plain.includes(NOVA.name) ? plain : `${NOVA.name}, ${plain}`);
          }
        }
        return;
      }

      if (!isFinal && sessionFull.length < 3) return;

      if (!voice && !transcriptHasWakeWord(sessionFull)) {
        if (isFinal && isDirectNovaIntent(sessionFull)) {
          dispatchCommand(
            sessionFull.includes(NOVA.name) ? sessionFull : `${NOVA.name}, ${sessionFull}`
          );
        }
        return;
      }

      if (voice?.activationOnly || (transcriptHasWakeWord(sessionFull) && !voice?.command)) {
        if (isFinal || sessionFull.length > 4) triggerWake();
        return;
      }

      if (isFinal && transcriptHasWakeWord(sessionFull)) {
        triggerWake();
      }
    },
    [dispatchCommand, resetAwakenedSilence, triggerWake]
  );

  const beginRecognition = useCallback(async () => {
    if (
      !enabledRef.current ||
      pausedRef.current ||
      busyRef.current ||
      listeningRef.current ||
      startingRef.current
    ) {
      return;
    }

    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError("Use Chrome or Edge browser.");
      return;
    }

    if (!claimSpeechRecognition("wake")) {
      scheduleRestart(800);
      return;
    }

    startingRef.current = true;

    try {
      await waitBeforeSpeechStart();

      const alreadyGranted =
        micGrantedRef.current || (await microphonePermissionGranted());
      if (!alreadyGranted) {
        const micOk = await ensureMicrophoneAccess();
        if (!micOk) {
          releaseSpeechRecognition("wake");
          startingRef.current = false;
          setError("Allow microphone — check the lock icon in the address bar.");
          setPhaseSafe("off");
          return;
        }
      }
      micGrantedRef.current = true;

      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }

      await waitBeforeSpeechStart();

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;

    recognition.onstart = () => {
      startingRef.current = false;
      listeningRef.current = true;
      transientFailRef.current = 0;
      if (phaseRef.current !== "awakened") setPhaseSafe("standby");
      setError(null);
    };

    recognition.onresult = (event) => {
      const full = fullSessionTranscript(event);
      const isFinal = hasFinalResult(event);
      processText(full, isFinal);
    };

    recognition.onerror = (event) => {
      startingRef.current = false;
      listeningRef.current = false;
      recRef.current = null;
      releaseSpeechRecognition("wake");

      if (event.error === "aborted") return;

      if (event.error === "not-allowed") {
        micGrantedRef.current = false;
        transientFailRef.current = 0;
        setError(speechErrorMessage(event.error));
        setPhaseSafe("off");
        return;
      }

      if (event.error === "no-speech") {
        transientFailRef.current = 0;
        setError(null);
        scheduleRestart(500);
        return;
      }

      if (isTransientSpeechError(event.error)) {
        transientFailRef.current += 1;
        const delay = Math.min(
          12000,
          900 * 2 ** Math.min(transientFailRef.current - 1, 4)
        );
        if (transientFailRef.current >= TRANSIENT_ERROR_SHOW_AFTER) {
          setError(speechErrorMessage(event.error));
        } else {
          setError(null);
        }
        scheduleRestart(delay);
        return;
      }

      setError(speechErrorMessage(event.error));
      scheduleRestart(1200);
    };

    recognition.onend = () => {
      startingRef.current = false;
      listeningRef.current = false;
      recRef.current = null;
      releaseSpeechRecognition("wake");
      if (!enabledRef.current || pausedRef.current || busyRef.current) return;
      if (restartTimerRef.current) return;
      scheduleRestart(phaseRef.current === "awakened" ? 250 : RESTART_MS);
    };

    recRef.current = recognition;
    try {
      recognition.start();
    } catch {
      startingRef.current = false;
      listeningRef.current = false;
      recRef.current = null;
      releaseSpeechRecognition("wake");
      setError("Mic busy — turn off manual mic, then retry.");
      scheduleRestart(1500);
    }
    } catch {
      startingRef.current = false;
      releaseSpeechRecognition("wake");
      scheduleRestart(1200);
    }
  }, [lang, processText, scheduleRestart]);

  beginRecognitionRef.current = () => {
    void beginRecognition();
  };

  useEffect(() => {
    pausedRef.current = paused;
    if (paused && listeningRef.current) {
      try {
        recRef.current?.stop();
      } catch {
        try {
          recRef.current?.abort();
        } catch {
          /* ignore */
        }
      }
      listeningRef.current = false;
      releaseSpeechRecognition("wake");
    } else if (enabledRef.current && supported && !listeningRef.current && !busyRef.current) {
      scheduleRestart(200);
    }
  }, [paused, supported, scheduleRestart]);

  const stopAll = useCallback(() => {
    clearTimers();
    busyRef.current = false;
    listeningRef.current = false;
    startingRef.current = false;
    transientFailRef.current = 0;
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    releaseSpeechRecognition("wake");
    setPhaseSafe("off");
    setLastHeard("");
  }, []);

  useEffect(() => {
    if (!supported) return;
    if (enabled) {
      beginRecognitionRef.current();
    } else {
      stopAll();
    }
    return () => {
      clearTimers();
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
      releaseSpeechRecognition("wake");
    };
  }, [enabled, supported, stopAll]);

  const retry = useCallback(() => {
    transientFailRef.current = 0;
    setError(null);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    scheduleRestart(200);
  }, [scheduleRestart]);

  return { phase, supported, error, lastHeard, stop: stopAll, retry };
}

export function playNovaChime() {
  if (typeof window === "undefined") return;
  unlockNovaVoice();
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    /* ignore */
  }
}
