"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { speakNovaText, stopNovaSpeech, unlockNovaVoice } from "@/lib/nova-voice";

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
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
};

const SILENCE_SEND_MS = 1800;
const RESTART_GAP_MS = 900;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function collectTranscript(event: SpeechRecognitionEvent): string {
  let text = "";
  for (let i = 0; i < event.results.length; i++) {
    text += event.results[i][0]?.transcript ?? "";
  }
  return text.trim();
}

import {
  claimSpeechRecognition,
  ensureMicrophoneAccess,
  isTransientSpeechError,
  releaseSpeechRecognition,
  speechErrorMessage,
  waitBeforeSpeechStart,
} from "@/lib/speech-recognition";

export function useVoiceInput({
  onTranscript,
  onComplete,
  lang = "en-IN",
  autoRestart = false,
  paused = false,
}: {
  onTranscript: (text: string) => void;
  onComplete?: (finalText: string) => void;
  lang?: string;
  autoRestart?: boolean;
  paused?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const activeRef = useRef(false);
  const completedRef = useRef(false);
  const startInFlightRef = useRef(false);
  const transcriptRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onCompleteRef = useRef(onComplete);
  const autoRestartRef = useRef(autoRestart);
  const pausedRef = useRef(paused);
  const listeningRef = useRef(false);
  const doStartRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onCompleteRef.current = onComplete;
  }, [onTranscript, onComplete]);

  useEffect(() => {
    autoRestartRef.current = autoRestart;
  }, [autoRestart]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
  }, []);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const clearRestartTimer = () => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const scheduleRestart = useCallback((delayMs = RESTART_GAP_MS) => {
    if (!autoRestartRef.current || pausedRef.current) return;
    clearRestartTimer();
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (
        autoRestartRef.current &&
        !pausedRef.current &&
        !activeRef.current &&
        !startInFlightRef.current
      ) {
        completedRef.current = false;
        void doStartRef.current();
      }
    }, delayMs);
  }, []);

  const stopSilent = useCallback(() => {
    clearRestartTimer();
    completedRef.current = true;
    clearSilenceTimer();
    activeRef.current = false;
    setListening(false);

    const rec = recognitionRef.current;
    recognitionRef.current = null;
    try {
      rec?.abort();
    } catch {
      /* ignore */
    }
    releaseSpeechRecognition("manual");
  }, []);

  const resetPhrase = useCallback(() => {
    clearSilenceTimer();
    transcriptRef.current = "";
  }, []);

  const teardownRecognition = useCallback((send: boolean) => {
    if (completedRef.current) return;
    completedRef.current = true;

    clearSilenceTimer();
    activeRef.current = false;
    setListening(false);

    const rec = recognitionRef.current;
    recognitionRef.current = null;
    try {
      rec?.stop();
    } catch {
      try {
        rec?.abort();
      } catch {
        /* ignore */
      }
    }
    releaseSpeechRecognition("manual");

    const text = transcriptRef.current.trim();
    if (send && text) onCompleteRef.current?.(text);
  }, []);

  const finish = useCallback(
    (send: boolean) => {
      teardownRecognition(send);
      scheduleRestart();
    },
    [teardownRecognition, scheduleRestart]
  );

  const scheduleAutoSend = useCallback(() => {
    clearSilenceTimer();
    if (!activeRef.current) return;
    silenceTimerRef.current = setTimeout(() => {
      if (activeRef.current && transcriptRef.current.trim()) {
        finish(true);
      }
    }, SILENCE_SEND_MS);
  }, [finish]);

  const stop = useCallback(() => {
    if (!activeRef.current) return;
    finish(true);
  }, [finish]);

  const doStart = useCallback(async () => {
    if (startInFlightRef.current) {
      scheduleRestart(600);
      return;
    }
    if (pausedRef.current) {
      scheduleRestart(400);
      return;
    }
    if (activeRef.current && listeningRef.current) return;

    unlockNovaVoice();
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError("Voice is not supported in this browser.");
      return;
    }

    startInFlightRef.current = true;
    completedRef.current = false;
    setError(null);
    transcriptRef.current = "";

    if (!claimSpeechRecognition("manual")) {
      startInFlightRef.current = false;
      scheduleRestart(1000);
      return;
    }

    try {
      await waitBeforeSpeechStart();

      const micOk = await ensureMicrophoneAccess();
      if (!micOk) {
        releaseSpeechRecognition("manual");
        setError(speechErrorMessage("not-allowed"));
        startInFlightRef.current = false;
        scheduleRestart(2000);
        return;
      }

      if (pausedRef.current) {
        releaseSpeechRecognition("manual");
        startInFlightRef.current = false;
        scheduleRestart(500);
        return;
      }

      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }

      await waitBeforeSpeechStart();

      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        activeRef.current = true;
        setListening(true);
        setError(null);
      };

      recognition.onresult = (event) => {
        const text = collectTranscript(event);
        if (!text) return;
        transcriptRef.current = text;
        onTranscriptRef.current(text);
        scheduleAutoSend();
      };

      recognition.onerror = (event) => {
        const code = event.error;
        if (code === "aborted") return;
        if (code === "not-allowed") {
          setError(speechErrorMessage(code));
          finish(false);
          return;
        }
        if (code === "no-speech" || isTransientSpeechError(code)) {
          if (code !== "no-speech") setError(speechErrorMessage(code));
          finish(false);
          return;
        }
        setError(speechErrorMessage(code));
        finish(false);
      };

      recognition.onend = () => {
        releaseSpeechRecognition("manual");
        if (completedRef.current) {
          scheduleRestart();
          return;
        }
        const text = transcriptRef.current.trim();
        if (text) {
          finish(true);
        } else {
          activeRef.current = false;
          setListening(false);
          clearSilenceTimer();
          completedRef.current = true;
          scheduleRestart();
        }
      };

      recognitionRef.current = recognition;
      activeRef.current = true;

      try {
        recognition.start();
        setListening(true);
      } catch {
        activeRef.current = false;
        setListening(false);
        recognitionRef.current = null;
        releaseSpeechRecognition("manual");
        completedRef.current = true;
        setError("Could not start microphone.");
        scheduleRestart(1500);
      }
    } catch {
      releaseSpeechRecognition("manual");
      completedRef.current = true;
      setError("Could not start microphone.");
      scheduleRestart(1500);
    } finally {
      startInFlightRef.current = false;
    }
  }, [lang, finish, scheduleAutoSend, scheduleRestart]);

  doStartRef.current = doStart;

  const start = useCallback(() => {
    clearRestartTimer();
    completedRef.current = false;
    void doStart();
  }, [doStart]);

  useEffect(() => {
    if (!autoRestart) return;

    const watchdog = window.setInterval(() => {
      if (
        autoRestartRef.current &&
        !pausedRef.current &&
        !activeRef.current &&
        !listeningRef.current &&
        !startInFlightRef.current &&
        !restartTimerRef.current
      ) {
        scheduleRestart(200);
      }
    }, 2500);

    return () => window.clearInterval(watchdog);
  }, [autoRestart, scheduleRestart]);

  useEffect(() => {
    if (!autoRestart) return;

    if (paused) {
      clearRestartTimer();
      if (activeRef.current || listening) {
        completedRef.current = true;
        clearSilenceTimer();
        activeRef.current = false;
        setListening(false);
        const rec = recognitionRef.current;
        recognitionRef.current = null;
        try {
          rec?.abort();
        } catch {
          /* ignore */
        }
        releaseSpeechRecognition("manual");
      }
      return;
    }

    if (!activeRef.current && !listening) {
      scheduleRestart(600);
    }
  }, [autoRestart, paused, listening, scheduleRestart]);

  const restart = useCallback(() => {
    scheduleRestart(400);
  }, [scheduleRestart]);

  const restartFresh = useCallback(() => {
    clearSilenceTimer();
    transcriptRef.current = "";

    if (activeRef.current || listeningRef.current) {
      completedRef.current = true;
      activeRef.current = false;
      setListening(false);
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try {
        rec?.abort();
      } catch {
        /* ignore */
      }
      releaseSpeechRecognition("manual");
    }

    completedRef.current = false;
    scheduleRestart(800);
  }, [scheduleRestart]);

  const toggle = useCallback(() => {
    if (listening || activeRef.current) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      clearRestartTimer();
      activeRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { listening, supported, error, start, stop, stopSilent, resetPhrase, restart, restartFresh, toggle };
}

export function speakText(text: string) {
  void speakNovaText(text);
}

export function stopSpeaking() {
  stopNovaSpeech();
}
