import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

function fileNameForBlob(blob: Blob): string {
  const t = blob.type || "";
  if (t.includes("mp4") || t.includes("m4a")) return "audio.m4a";
  if (t.includes("mpeg") || t.includes("mp3")) return "audio.mp3";
  if (t.includes("wav")) return "audio.wav";
  return "audio.webm";
}

function parseOpenAiError(raw: string): string {
  try {
    const j = JSON.parse(raw) as { error?: { message?: string; code?: string } };
    const code = j.error?.code;
    const msg = j.error?.message ?? "";
    if (code === "invalid_api_key") {
      return "OpenAI API key invalid — update OPENAI_API_KEY in .env";
    }
    if (code === "insufficient_quota") {
      return "OpenAI quota exceeded — check billing at platform.openai.com";
    }
    if (/invalid file format|could not process/i.test(msg)) {
      return "Audio format not accepted — retry or use browser mic";
    }
    if (msg) return msg.slice(0, 160);
  } catch {
    /* ignore */
  }
  return "Transcription failed — check API key and internet";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Whisper not configured" }, { status: 503 });
  }

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size < 500) {
    return NextResponse.json({ error: "No audio captured — speak louder and retry" }, { status: 400 });
  }

  const body = new FormData();
  body.append("file", audio, fileNameForBlob(audio));
  body.append("model", "whisper-1");
  body.append("language", "en");
  body.append(
    "prompt",
    "Hindi and English. Hey Maya. Maya assistant. Bhupesh Sharma report, production department, employee KPI, Bony Polymers, batao, dikhao."
  );

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    });
  } catch {
    return NextResponse.json({ error: "Network error — check internet connection" }, { status: 502 });
  }

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("Whisper error:", res.status, err);
    return NextResponse.json({ error: parseOpenAiError(err) }, { status: 502 });
  }

  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  return NextResponse.json({ text });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = process.env.OPENAI_API_KEY?.trim();
  return NextResponse.json({
    whisperEnabled: Boolean(key),
    browserFallback: true,
  });
}
