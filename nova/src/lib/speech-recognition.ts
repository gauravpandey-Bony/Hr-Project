/** Single mic lock — Chrome allows only one SpeechRecognition at a time */

let activeOwner: "wake" | "manual" | null = null;
let lastReleaseAt = 0;

/** Chrome needs a gap between stop/abort and the next start (avoids "network" errors). */
const MIN_RESTART_GAP_MS = 700;

export function isBrowserSpeechRecognitionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** Mic APIs require HTTPS (or localhost). */
export function isVoiceSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true;
}

export function voiceContextHint(): string | null {
  if (isVoiceSecureContext()) return null;
  if (isBrowserSpeechRecognitionAvailable()) {
    return "Mic works best on HTTPS — allow microphone when Chrome asks, or open the site via https://.";
  }
  return "Voice needs HTTPS (secure site). You can still type your question below.";
}

export type MicrophonePrimeResult = {
  ok: boolean;
  speechOnly: boolean;
  reason?: string;
};

/** Preflight mic — on HTTP skip getUserMedia and let SpeechRecognition prompt. */
export async function primeMicrophoneForVoice(): Promise<MicrophonePrimeResult> {
  if (!isBrowserSpeechRecognitionAvailable()) {
    return {
      ok: false,
      speechOnly: false,
      reason: "Voice is not supported in this browser — use Chrome or Edge.",
    };
  }

  if (!isVoiceSecureContext()) {
    return { ok: true, speechOnly: true };
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: true, speechOnly: true };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return { ok: true, speechOnly: false };
  } catch {
    return {
      ok: true,
      speechOnly: true,
      reason: voiceContextHint() ?? speechErrorMessage("not-allowed"),
    };
  }
}

export function claimSpeechRecognition(owner: "wake" | "manual"): boolean {
  if (activeOwner && activeOwner !== owner) return false;
  activeOwner = owner;
  return true;
}

export function releaseSpeechRecognition(owner: "wake" | "manual") {
  if (activeOwner === owner) {
    activeOwner = null;
    lastReleaseAt = Date.now();
  }
}

export async function waitBeforeSpeechStart(): Promise<void> {
  const elapsed = Date.now() - lastReleaseAt;
  const wait = MIN_RESTART_GAP_MS - elapsed;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

const TRANSIENT_SPEECH_ERRORS = new Set([
  "network",
  "service-not-available",
  "audio-capture",
]);

export function isTransientSpeechError(code: string): boolean {
  return TRANSIENT_SPEECH_ERRORS.has(code);
}

export function speechErrorMessage(code: string): string {
  switch (code) {
    case "network":
      return "Voice needs internet (Google speech). Check Wi‑Fi, tap Retry mic, or type your question.";
    case "service-not-available":
      return "Speech service unavailable — retry in a moment or type your question.";
    case "not-allowed":
      return "Allow microphone — check the lock icon in the address bar.";
    case "audio-capture":
      return "Microphone busy — close other apps using the mic, then retry.";
    case "no-speech":
      return "No speech detected — try again.";
    default:
      return `Mic error (${code}) — retry or type your question.`;
  }
}

export async function ensureMicrophoneAccess(): Promise<boolean> {
  const primed = await primeMicrophoneForVoice();
  return primed.ok;
}

export async function microphonePermissionGranted(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  try {
    const perm = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return perm.state === "granted";
  } catch {
    return false;
  }
}
