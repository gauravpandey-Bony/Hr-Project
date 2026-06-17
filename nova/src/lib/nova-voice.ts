/** Maya TTS — OpenAI voice (primary) + browser speech (fallback) */

const NOVA_TTS = {
  rate: 0.9,
  pitch: 1.05,
  volume: 1,
} as const;

const VOICE_PREFERENCES: RegExp[] = [
  /\bsamantha\b/i,
  /\bveena\b/i,
  /\bpriya\b/i,
  /\bneerja\b/i,
  /\blekha\b/i,
  /\baditi\b/i,
  /\bgoogle.*english.*india/i,
  /\ben[- ]?in\b/i,
  /\ben[- ]?us\b/i,
  /\bkaren\b/i,
];

let voicesCache: SpeechSynthesisVoice[] = [];
let currentAudio: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
/** Skip slow OpenAI TTS retries after first failure this session */
let openAiTtsUnavailable = false;

export type NovaSpeakResult = { ok: true } | { ok: false; reason: string };

function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[#•|]/g, "")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 480);
}

function scoreVoice(v: SpeechSynthesisVoice, preferHindi: boolean): number {
  let score = 0;
  const label = `${v.name} ${v.voiceURI}`;
  for (let i = 0; i < VOICE_PREFERENCES.length; i++) {
    if (VOICE_PREFERENCES[i].test(label)) score += 50 - i;
  }
  const lang = v.lang.toLowerCase();
  if (preferHindi && lang.startsWith("hi")) score += 40;
  if (!preferHindi && lang === "en-in") score += 45;
  if (!preferHindi && lang.startsWith("en")) score += 20;
  if (/female|woman|feminine/i.test(label)) score += 20;
  if (/male|man/i.test(label)) score -= 30;
  return score;
}

function pickBrowserVoice(
  voices: SpeechSynthesisVoice[],
  text: string
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const preferHindi = hasDevanagari(text);
  const ranked = [...voices]
    .map((v) => ({ v, score: scoreVoice(v, preferHindi) }))
    .sort((a, b) => b.score - a.score);
  if (ranked[0].score > 0) return ranked[0].v;
  const enIn = voices.find((v) => v.lang.toLowerCase() === "en-in");
  if (enIn) return enIn;
  const en = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  return en ?? voices[0];
}

function refreshVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const list = window.speechSynthesis.getVoices();
  if (list.length > 0) voicesCache = list;
  return voicesCache;
}

async function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const existing = refreshVoices();
  if (existing.length > 0) return existing;

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(refreshVoices());
    };
    window.speechSynthesis.onvoiceschanged = () => {
      if (refreshVoices().length > 0) finish();
    };
    window.setTimeout(finish, 1000);
  });
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

/** Call synchronously inside click handler — unlocks Web Audio + speech. */
export function unlockNovaVoice(): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = getAudioContext();
    void ctx?.resume();
    const synth = window.speechSynthesis;
    if (synth) {
      synth.resume();
      const prime = new SpeechSynthesisUtterance(" ");
      prime.volume = 0.01;
      prime.rate = 2;
      synth.speak(prime);
    }
  } catch {
    /* ignore */
  }
  void ensureVoicesLoaded();
}

async function checkTtsApi(): Promise<boolean> {
  try {
    const res = await fetch("/api/ai/tts", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { ttsEnabled?: boolean };
    return Boolean(data.ttsEnabled);
  } catch {
    return false;
  }
}

function startChromeResumeLoop(): () => void {
  if (typeof window === "undefined" || !window.speechSynthesis) return () => {};
  const id = window.setInterval(() => {
    if (window.speechSynthesis.speaking) window.speechSynthesis.resume();
  }, 100);
  return () => window.clearInterval(id);
}

async function playArrayBuffer(arrayBuffer: ArrayBuffer): Promise<boolean> {
  const ctx = getAudioContext();
  if (ctx) {
    try {
      await ctx.resume();
      const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      if (currentSource) {
        try {
          currentSource.stop();
        } catch {
          /* ignore */
        }
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      currentSource = source;
      return await new Promise((resolve) => {
        source.onended = () => {
          if (currentSource === source) currentSource = null;
          resolve(true);
        };
        try {
          source.start(0);
        } catch {
          resolve(false);
        }
      });
    } catch {
      /* fall through to HTML Audio */
    }
  }

  stopNovaSpeech();
  const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.volume = 1;
  currentAudio = audio;

  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      resolve(ok);
    };
    audio.onended = () => done(true);
    audio.onerror = () => done(false);
    void audio.play().then(() => {}).catch(() => done(false));
  });
}

async function speakViaOpenAI(clean: string): Promise<NovaSpeakResult> {
  const enabled = await checkTtsApi();
  if (!enabled) {
    return { ok: false, reason: "OpenAI voice not configured on server — restart dev server." };
  }

  try {
    const res = await fetch("/api/ai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean }),
    });

    if (res.status === 401) {
      return { ok: false, reason: "Please log in again to use Maya voice." };
    }
    if (res.status === 502 || res.status === 503) {
      openAiTtsUnavailable = true;
      return { ok: false, reason: "Using browser voice (OpenAI TTS unavailable)." };
    }
    if (!res.ok) {
      return { ok: false, reason: `Voice API error (${res.status}).` };
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength < 128) {
      return { ok: false, reason: "Empty audio from voice API." };
    }

    stopNovaSpeech();
    const played = await playArrayBuffer(arrayBuffer);
    return played
      ? { ok: true }
      : { ok: false, reason: "Could not play audio — check Mac volume & tap Enable Hey Maya again." };
  } catch {
    return { ok: false, reason: "Network error while fetching Maya voice." };
  }
}

async function speakViaBrowser(clean: string): Promise<NovaSpeakResult> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return { ok: false, reason: "Browser speech not supported — use Chrome or Edge." };
  }

  unlockNovaVoice();

  const synth = window.speechSynthesis;
  const voices = await ensureVoicesLoaded();
  const voice = pickBrowserVoice(voices.length ? voices : refreshVoices(), clean);

  if (synth.speaking) {
    synth.cancel();
    await new Promise((r) => setTimeout(r, 200));
  }

  const stopResume = startChromeResumeLoop();

  const speakOnce = (line: string, v: SpeechSynthesisVoice | null) =>
    new Promise<boolean>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(line);
      if (v) {
        utterance.voice = v;
        utterance.lang = v.lang;
      } else {
        utterance.lang = hasDevanagari(line) ? "hi-IN" : "en-IN";
      }
      utterance.rate = NOVA_TTS.rate;
      utterance.pitch = NOVA_TTS.pitch;
      utterance.volume = NOVA_TTS.volume;

      let finished = false;
      let started = false;
      const finish = (ok: boolean) => {
        if (finished) return;
        finished = true;
        resolve(ok);
      };
      utterance.onstart = () => {
        started = true;
      };
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      window.setTimeout(() => {
        if (!finished && !started && !synth.speaking) finish(false);
      }, 12000);
      synth.speak(utterance);
      synth.resume();
    });

  const lines = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks = lines.length > 0 ? lines : [clean];

  for (const chunk of chunks.slice(0, 2)) {
    const voiceCandidates = [voice, null].filter(
      (v, i, arr) => arr.findIndex((x) => x?.name === v?.name) === i
    );
    let spoke = false;
    for (const v of voiceCandidates) {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 250));
        if (await speakOnce(chunk, v)) {
          spoke = true;
          break;
        }
      }
      if (spoke) break;
    }
    if (!spoke) {
      stopResume();
      return {
        ok: false,
        reason: "Speaker unavailable — mic still works. Check Mac volume or use Chrome.",
      };
    }
  }

  stopResume();
  return { ok: true };
}

export async function speakNovaText(text: string): Promise<boolean> {
  const result = await speakNovaTextDetailed(text);
  return result.ok;
}

export async function speakNovaTextDetailed(text: string): Promise<NovaSpeakResult> {
  const clean = cleanForSpeech(text);
  if (!clean) return { ok: false, reason: "Nothing to speak." };

  unlockNovaVoice();

  if (!openAiTtsUnavailable) {
    const ttsEnabled = await checkTtsApi();
    if (ttsEnabled) {
      const viaApi = await speakViaOpenAI(clean);
      if (viaApi.ok) return viaApi;
      if (viaApi.reason.includes("unavailable")) openAiTtsUnavailable = true;
    }
  }

  return speakViaBrowser(clean);
}

export function stopNovaSpeech() {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      /* ignore */
    }
    currentSource = null;
  }
  if (typeof window !== "undefined") {
    window.speechSynthesis?.cancel();
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
}

export function isNovaVoiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export async function testNovaVoice(): Promise<NovaSpeakResult> {
  return speakNovaTextDetailed("Maya is ready. How can I help you?");
}
