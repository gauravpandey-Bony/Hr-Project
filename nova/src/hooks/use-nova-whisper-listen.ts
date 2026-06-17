"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeNovaVoiceMessage, isDirectNovaIntent, NOVA } from "@/lib/ai/nova-assistant";

const RECORD_MS = 4000;
const LOOP_GAP_MS = 400;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

const GARBAGE = /^(thank you|thanks for watching|subtitle|you\.?|\.+|\s*)$/i;

export function isUsefulTranscript(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return false;
  if (GARBAGE.test(t)) return false;
  return true;
}

async function transcribeBlob(
  blob: Blob
): Promise<{ text: string; error?: string }> {
  const form = new FormData();
  const ext = blob.type.includes("mp4") ? "nova.m4a" : "nova.webm";
  form.append("audio", blob, ext);
  const res = await fetch("/api/ai/transcribe", { method: "POST", body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { text: "", error: body.error ?? `Transcribe failed (${res.status})` };
  }
  const data = (await res.json()) as { text?: string };
  return { text: (data.text ?? "").trim() };
}

function recordSegment(stream: MediaStream, ms: number): Promise<Blob | null> {
  const mime = pickMimeType();
  if (!mime) return Promise.resolve(null);

  return new Promise((resolve) => {
    const chunks: Blob[] = [];
    let recorder: MediaRecorder;

    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      resolve(null);
      return;
    }

    const done = (blob: Blob | null) => resolve(blob);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => done(null);
    recorder.onstop = () => {
      if (chunks.length === 0) {
        done(null);
        return;
      }
      done(new Blob(chunks, { type: mime }));
    };

    try {
      recorder.start(250);
      setTimeout(() => {
        try {
          if (recorder.state === "recording") recorder.stop();
        } catch {
          done(null);
        }
      }, ms);
    } catch {
      done(null);
    }
  });
}

export function useNovaWhisperListen({
  enabled,
  paused,
  onTranscript,
  onCommand,
  onHeard,
  onError,
}: {
  enabled: boolean;
  paused: boolean;
  onTranscript: (text: string) => void;
  onCommand: (message: string) => void;
  /** Raw transcript handler — when set, skips built-in auto-send */
  onHeard?: (raw: string) => void;
  onError?: (message: string | null) => void;
}) {
  const [armed, setArmed] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState("");

  const enabledRef = useRef(enabled);
  const pausedRef = useRef(paused);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const loopRunningRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const onCommandRef = useRef(onCommand);
  const onHeardRef = useRef(onHeard);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onCommandRef.current = onCommand;
    onHeardRef.current = onHeard;
    onErrorRef.current = onError;
  }, [onTranscript, onCommand, onHeard, onError]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const stopStream = useCallback(() => {
    runningRef.current = false;
    setArmed(false);
    setCapturing(false);
    setProcessing(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const listenLoop = useCallback(async () => {
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;

    while (runningRef.current && enabledRef.current && !pausedRef.current) {
      const stream = streamRef.current;
      if (!stream) break;

      setError(null);
      setCapturing(true);

      const blob = await recordSegment(stream, RECORD_MS);
      setCapturing(false);

      if (!runningRef.current || pausedRef.current) break;

      if (!blob || blob.size < 500) {
        await new Promise((r) => setTimeout(r, LOOP_GAP_MS));
        continue;
      }

      setProcessing(true);
      try {
        const { text: raw, error: err } = await transcribeBlob(blob);
        if (err) {
          setError(err);
          onErrorRef.current?.(err);
        } else {
          const display = raw.trim();
          if (display.length > 0) {
            setLastHeard(display);
            onTranscriptRef.current(display);

            if (onHeardRef.current) {
              onHeardRef.current(display);
            } else {
              const canSend =
                isUsefulTranscript(display) || isDirectNovaIntent(display);

              if (canSend) {
                let msg = normalizeNovaVoiceMessage(display);
                if (
                  !msg.toLowerCase().includes(NOVA.name.toLowerCase()) &&
                  (msg.length > 2 || isDirectNovaIntent(display))
                ) {
                  msg = `${NOVA.name}, ${msg}`;
                }
                if (msg && msg !== NOVA.name && msg.length > 3) {
                  await new Promise((r) => setTimeout(r, 800));
                  if (runningRef.current && !pausedRef.current) {
                    onCommandRef.current(msg);
                  }
                }
              } else if (display.length > 2) {
                setError(`Suna: "${display}" — dubara saaf awaaz mein bolo.`);
              }
            }
          }
        }
      } catch {
        setError("Could not transcribe — check internet.");
      } finally {
        setProcessing(false);
      }

      if (!runningRef.current || pausedRef.current) break;
      await new Promise((r) => setTimeout(r, LOOP_GAP_MS));
    }

    setCapturing(false);
    setProcessing(false);
    loopRunningRef.current = false;
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    stopStream();
    setError(null);

    if (!pickMimeType()) {
      setError("Audio recording not supported — use Chrome or Edge.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      runningRef.current = true;
      setArmed(true);
      void listenLoop();
    } catch {
      setError("Allow microphone in browser settings.");
      setArmed(false);
    }
  }, [listenLoop, stopStream]);

  const stop = useCallback(() => {
    stopStream();
    setLastHeard("");
  }, [stopStream]);

  useEffect(() => {
    if (enabled && !paused) {
      if (!runningRef.current) {
        void start();
      } else if (streamRef.current && !loopRunningRef.current) {
        void listenLoop();
      }
    } else if (!enabled) {
      stop();
    }
  }, [enabled, paused, start, stop, listenLoop]);

  useEffect(() => () => stop(), [stop]);

  return {
    armed,
    capturing,
    processing,
    listening: armed,
    error,
    lastHeard,
    start,
    stop,
  };
}
