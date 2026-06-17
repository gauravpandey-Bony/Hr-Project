/** Single mic lock — Chrome allows only one SpeechRecognition at a time */

let activeOwner: "wake" | "manual" | null = null;
let lastReleaseAt = 0;

/** Chrome needs a gap between stop/abort and the next start (avoids "network" errors). */
const MIN_RESTART_GAP_MS = 700;

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
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return true;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
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
