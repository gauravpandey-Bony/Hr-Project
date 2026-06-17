"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  extractNovaVoiceCommand,
  isDirectNovaIntent,
  normalizeNovaVoiceMessage,
  NOVA,
  transcriptHasWakeWord,
} from "@/lib/ai/nova-assistant";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { isWakeSupported } from "@/hooks/use-nova-wake";

export type MayaVoicePhase = "off" | "standby" | "awakened" | "recording";

const COMMAND_SEND_MS = 1400;

function toCommand(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 3) return null;
  if (/^(thank you|thanks for watching|subtitle|you\.?|\.)$/i.test(trimmed)) return null;

  const voice = extractNovaVoiceCommand(trimmed);
  if (voice?.activationOnly) return null;

  if (voice && voice.command.length > 1) {
    return normalizeNovaVoiceMessage(trimmed);
  }

  if (isDirectNovaIntent(trimmed) || trimmed.length >= 5) {
    if (trimmed.toLowerCase().includes(NOVA.name.toLowerCase())) return trimmed;
    return `${NOVA.name}, ${trimmed}`;
  }

  return null;
}

function isHeyMaya(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  const voice = extractNovaVoiceCommand(text);
  if (voice?.activationOnly) return true;
  return /^(?:hey|hi|ok|hello)?\s*(?:hey\s+)?maya[!.?\s]*$/i.test(t);
}

export function useMayaVoice({
  enabled,
  paused,
  onTranscript,
  onCommand,
  onActivate,
}: {
  enabled: boolean;
  paused: boolean;
  onTranscript: (text: string) => void;
  onCommand: (message: string) => void;
  onActivate: () => void;
}) {
  const [phase, setPhase] = useState<MayaVoicePhase>("off");
  const [notice, setNotice] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState("");
  const [mounted, setMounted] = useState(false);
  const awakenedRef = useRef(false);
  const pausedRef = useRef(paused);
  const enabledRef = useRef(enabled);
  const listeningRef = useRef(false);
  const onCommandRef = useRef(onCommand);
  const onActivateRef = useRef(onActivate);
  const onTranscriptRef = useRef(onTranscript);
  const busyRef = useRef(false);
  const lastWakeAtRef = useRef(0);
  const commandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCommandRef = useRef("");
  const resetPhraseRef = useRef<() => void>(() => {});
  const restartRef = useRef<() => void>(() => {});
  const restartFreshRef = useRef<() => void>(() => {});
  const resumePendingRef = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    pausedRef.current = paused;
    enabledRef.current = enabled;
    if (!paused && resumePendingRef.current && enabled) {
      resumePendingRef.current = false;
      window.setTimeout(() => {
        awakenedRef.current = false;
        busyRef.current = false;
        restartFreshRef.current();
      }, 600);
    }
  }, [paused, enabled]);

  useEffect(() => {
    onCommandRef.current = onCommand;
    onActivateRef.current = onActivate;
    onTranscriptRef.current = onTranscript;
  }, [onCommand, onActivate, onTranscript]);

  const clearCommandTimer = useCallback(() => {
    if (commandTimerRef.current) {
      clearTimeout(commandTimerRef.current);
      commandTimerRef.current = null;
    }
    pendingCommandRef.current = "";
  }, []);

  const activateWake = useCallback(() => {
    const now = Date.now();
    if (now - lastWakeAtRef.current < 800) return;
    lastWakeAtRef.current = now;
    awakenedRef.current = true;
    setPhase("awakened");
    onActivateRef.current();
    resetPhraseRef.current();
    clearCommandTimer();
  }, [clearCommandTimer]);

  const dispatchCommand = useCallback(
    (display: string) => {
      if (busyRef.current || pausedRef.current) return false;

      const cmd = toCommand(display);
      if (!cmd) {
        if (awakenedRef.current && display.length >= 3) {
          busyRef.current = true;
          awakenedRef.current = false;
          setPhase("standby");
          clearCommandTimer();
          onCommandRef.current(`${NOVA.name}, ${display}`);
          window.setTimeout(() => {
            busyRef.current = false;
          }, 800);
          return true;
        }
        return false;
      }

      const canSend =
        awakenedRef.current ||
        transcriptHasWakeWord(display) ||
        isDirectNovaIntent(display);

      if (!canSend) return false;

      busyRef.current = true;
      awakenedRef.current = false;
      setPhase("standby");
      clearCommandTimer();
      onCommandRef.current(cmd);
      window.setTimeout(() => {
        busyRef.current = false;
      }, 800);
      return true;
    },
    [clearCommandTimer]
  );

  const scheduleCommand = useCallback(
    (display: string) => {
      if (busyRef.current || isHeyMaya(display)) return;

      const canTry =
        awakenedRef.current ||
        transcriptHasWakeWord(display) ||
        isDirectNovaIntent(display);

      if (!canTry || display.length < 4) return;

      pendingCommandRef.current = display;
      if (commandTimerRef.current) clearTimeout(commandTimerRef.current);

      commandTimerRef.current = setTimeout(() => {
        commandTimerRef.current = null;
        const text = pendingCommandRef.current.trim();
        pendingCommandRef.current = "";
        if (!text || busyRef.current || pausedRef.current) return;
        dispatchCommand(text);
      }, COMMAND_SEND_MS);
    },
    [dispatchCommand]
  );

  const handleLiveTranscript = useCallback(
    (raw: string) => {
      const display = raw.trim();
      onTranscriptRef.current(raw);
      if (!display) return;

      setLastHeard(display.slice(-100));

      if (isHeyMaya(display)) {
        activateWake();
        return;
      }
      scheduleCommand(display);
    },
    [activateWake, scheduleCommand]
  );

  const handleComplete = useCallback(
    (raw: string) => {
      const display = raw.trim();
      if (!display || busyRef.current) return;

      setLastHeard(display);
      onTranscriptRef.current(display);
      clearCommandTimer();

      if (isHeyMaya(display)) {
        activateWake();
        return;
      }

      dispatchCommand(display);
    },
    [activateWake, clearCommandTimer, dispatchCommand]
  );

  const browser = useVoiceInput({
    autoRestart: enabled,
    paused,
    onTranscript: handleLiveTranscript,
    onComplete: handleComplete,
  });

  useEffect(() => {
    listeningRef.current = browser.listening;
  }, [browser.listening]);

  const browserStartRef = useRef(browser.start);
  const browserStopRef = useRef(browser.stopSilent);

  useEffect(() => {
    browserStartRef.current = browser.start;
    browserStopRef.current = browser.stopSilent;
    resetPhraseRef.current = browser.resetPhrase;
    restartRef.current = browser.restart;
    restartFreshRef.current = browser.restartFresh;
  });

  useEffect(() => {
    if (!enabled) {
      awakenedRef.current = false;
      clearCommandTimer();
      setPhase("off");
      return;
    }
    if (paused) return;

    if (browser.listening) {
      setPhase(awakenedRef.current ? "awakened" : "recording");
    } else {
      setPhase("standby");
    }
  }, [enabled, paused, browser.listening, clearCommandTimer]);

  const stop = useCallback(() => {
    awakenedRef.current = false;
    busyRef.current = false;
    resumePendingRef.current = false;
    clearCommandTimer();
    setPhase("off");
    browserStopRef.current();
    setLastHeard("");
  }, [clearCommandTimer]);

  const start = useCallback(() => {
    void browserStartRef.current();
    if (enabled) setPhase("standby");
  }, [enabled]);

  const resumeListening = useCallback(() => {
    if (!enabledRef.current) return;
    busyRef.current = false;
    awakenedRef.current = false;
    clearCommandTimer();

    if (pausedRef.current) {
      resumePendingRef.current = true;
      return;
    }

    resumePendingRef.current = false;
    window.setTimeout(() => {
      if (enabledRef.current && !pausedRef.current) {
        restartFreshRef.current();
      }
    }, 800);
  }, [clearCommandTimer]);

  const wakeSupported = mounted && isWakeSupported();
  const error =
    browser.error ??
    (mounted && !isWakeSupported() ? "Voice not supported — use Chrome or Edge." : null);

  return {
    phase,
    listening: browser.listening,
    engine: "browser" as const,
    error: notice ?? error,
    lastHeard,
    stop,
    start,
    restart: () => restartRef.current(),
    restartFresh: () => restartFreshRef.current(),
    resumeListening,
    isReady: wakeSupported,
    useBrowserOnly: () => setNotice(null),
  };
}
