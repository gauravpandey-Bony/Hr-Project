"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  Mic,
  Volume2,
  VolumeX,
  Radio,
} from "lucide-react";
import { ChatBlocks } from "./chat-blocks";
import type { ChatMessage } from "@/lib/ai/chat";
import { cn } from "@/lib/utils";
import { stopSpeaking } from "@/hooks/use-voice-input";
import {
  speakNovaTextDetailed,
  stopNovaSpeech,
  unlockNovaVoice,
} from "@/lib/nova-voice";
import {
  getHeyNovaEnabled,
  setHeyNovaEnabled,
  getMicReadyStored,
  setMicReadyStored,
  playNovaChime,
} from "@/hooks/use-nova-wake";
import { useMayaVoice } from "@/hooks/use-maya-voice";
import {
  isVoiceSecureContext,
  primeMicrophoneForVoice,
  voiceContextHint,
} from "@/lib/speech-recognition";
import { NOVA } from "@/lib/ai/nova-assistant";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STARTERS = [
  "Maya, Bhupesh Sharma report",
  "Maya, production department report",
  "Maya, Mahima employee report",
  "Maya, show all KPIs",
];

export function AiChat({
  isAdmin,
  orgWide,
  unitId,
  unitName,
}: {
  isAdmin?: boolean;
  orgWide?: boolean;
  unitId?: string;
  unitName?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: orgWide
        ? `${NOVA.name} active — full organization access.`
        : `${NOVA.name} active — ${unitName ?? "your unit"}.`,
      blocks: [
        {
          type: "text",
          content: orgWide
            ? `**Hey Maya** — pucho kuch bhi! Main **saare units**, employees, departments aur KPIs ke baare mein bata sakta hoon.\n\nTry:\n• **Maya, Bhupesh Sharma report**\n• **Maya, production department report**\n• **Maya, show all KPIs**`
            : unitName
              ? `**Hey Maya** — ask about **${unitName}** KPIs, employees, or reports.`
              : `**Hey Maya** — ask about KPIs, employees, or department reports.`,
        },
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [heyNova, setHeyNova] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [ttsHold, setTtsHold] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [aiVoiceOn, setAiVoiceOn] = useState(false);
  const [voiceNeedsResume, setVoiceNeedsResume] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<(text?: string, fromVoice?: boolean) => void>(() => {});
  const voiceReplyRef = useRef(false);
  const heyNovaRef = useRef(false);
  const micReadyRef = useRef(false);
  const resumeListeningRef = useRef<() => void>(() => {});
  const startVoiceRef = useRef<() => void>(() => {});

  useEffect(() => {
    heyNovaRef.current = heyNova;
    micReadyRef.current = micReady;
  }, [heyNova, micReady]);

  const speakNovaReply = useCallback(async (text: string) => {
    setTtsError(null);
    setTtsHold(true);
    const result = await speakNovaTextDetailed(text);
    setTtsHold(false);
    setAiVoiceOn(result.ok);
    if (!result.ok) setTtsError(result.reason);
    return result.ok;
  }, []);

  const onVoiceCommand = useCallback((text: string) => {
    const msg = text.trim();
    if (!msg) return;
    setInput(msg);
    window.setTimeout(() => sendRef.current(msg, true), 300);
  }, []);

  const basePaused = loading || ttsHold || speaking;

  const {
    phase: voicePhase,
    listening: micListening,
    error: voiceError,
    lastHeard,
    stop: stopVoice,
    start: startVoice,
    resumeListening,
  } = useMayaVoice({
    enabled: heyNova && micReady,
    paused: basePaused,
    onActivate: playNovaChime,
    onCommand: onVoiceCommand,
    onTranscript: setInput,
  });

  const novaArmed = heyNova && micReady && voicePhase !== "off";
  const novaCapturing =
    micListening && (voicePhase === "awakened" || voicePhase === "recording");
  const micDead = heyNova && micReady && !micListening && !basePaused;

  useEffect(() => {
    resumeListeningRef.current = resumeListening;
    startVoiceRef.current = startVoice;
  }, [resumeListening, startVoice]);

  useEffect(() => {
    if (!getHeyNovaEnabled() || !getMicReadyStored()) return;
    setVoiceNeedsResume(true);
    unlockNovaVoice();
    void primeMicrophoneForVoice().then((primed) => {
      if (!primed.ok) {
        setVoiceNeedsResume(true);
        if (primed.reason) setTtsError(primed.reason);
        return;
      }
      setMicReady(true);
      setHeyNova(true);
      setHeyNovaEnabled(true);
      setVoiceNeedsResume(false);
      if (primed.speechOnly && !isVoiceSecureContext()) {
        setTtsError(voiceContextHint());
      }
      window.setTimeout(() => startVoiceRef.current(), 500);
    });
  }, []);

  async function enableListening() {
    unlockNovaVoice();
    setTtsError(null);

    const primed = await primeMicrophoneForVoice();
    if (!primed.ok) {
      setTtsError(primed.reason ?? "Microphone unavailable in this browser.");
      return;
    }

    setMicReady(true);
    setMicReadyStored(true);
    setHeyNova(true);
    setHeyNovaEnabled(true);
    setVoiceNeedsResume(false);
    if (primed.speechOnly && !isVoiceSecureContext()) {
      setTtsError(voiceContextHint());
    } else if (primed.reason) {
      setTtsError(primed.reason);
    }
    window.setTimeout(() => startVoice(), 400);
  }

  function disableListening() {
    stopVoice();
    setHeyNova(false);
    setHeyNovaEnabled(false);
    setMicReady(false);
    setMicReadyStored(false);
  }

  function toggleHeyNova() {
    if (!micReady || !heyNova) {
      void enableListening();
      return;
    }
    disableListening();
  }

  function handleMicButton() {
    unlockNovaVoice();
    if (!micReady || !heyNova) {
      void enableListening();
      return;
    }
    if (micDead) {
      resumeListeningRef.current();
      return;
    }
    disableListening();
  }

  useEffect(() => {
    const qs = unitId ? `?unit=${encodeURIComponent(unitId)}` : "";
    fetch(`/api/ai/chat${qs}`)
      .then((r) => r.json())
      .then((d) => setAiEnabled(d.aiEnabled));
  }, [unitId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string, fromVoice = false) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    voiceReplyRef.current = fromVoice;
    stopNovaSpeech();
    stopSpeaking();

    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, history, unit: unitId }),
    });

    const data = await res.json();
    setLoading(false);

    const resumeListen = () => {
      if (heyNovaRef.current && micReadyRef.current) {
        resumeListeningRef.current();
      }
    };

    if (res.ok && data.reply) {
      setMessages((prev) => [...prev, data.reply]);
      if (voiceReplyRef.current) {
        resumeListen();
      } else if (heyNovaRef.current && micReadyRef.current) {
        const intro =
          data.reply.blocks?.find((b: { type: string }) => b.type === "text")?.content ??
          data.reply.content;
        const spoken = intro
          .replace(/\*\*/g, "")
          .replace(/\[.*?\]/g, "")
          .slice(0, 220);
        if (spoken) {
          void speakNovaReply(spoken).then((ok) => {
            setAiVoiceOn(ok);
            resumeListen();
          });
        } else {
          resumeListen();
        }
      }
      voiceReplyRef.current = false;
    } else {
      voiceReplyRef.current = false;
      resumeListen();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong.",
          blocks: [{ type: "text", content: data.error ?? "Please try again." }],
        },
      ]);
    }
  }

  sendRef.current = send;

  async function readLastReply() {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    const text =
      last.blocks?.find((b) => b.type === "text")?.content ?? last.content;
    unlockNovaVoice();
    setSpeaking(true);
    const result = await speakNovaTextDetailed(text);
    setSpeaking(false);
    setAiVoiceOn(result.ok);
    if (!result.ok) setTtsError(result.reason);
  }

  function statusLabel() {
    if (heyNova && !micReady) return "Enable Hey Maya";
    if (basePaused) return "Maya reply de rahi hai…";
    if (voicePhase === "awakened" && micListening) return "Active — bolo apna sawaal";
    if (micListening) return "Sun rahi hoon…";
    if (micDead) return "Mic reconnect ho raha hai…";
    if (novaArmed) return 'Say "Hey Maya" — phir command';
    return `Type ${NOVA.name}, …`;
  }

  const engineLabel = "";

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 text-white">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">{NOVA.productLabel}</h2>
            <p className="flex items-center gap-2 text-xs text-violet-100">
              <span
                className={cn(
                  "inline-flex h-2 w-2 rounded-full",
                  novaCapturing
                    ? "animate-pulse bg-red-400"
                    : micListening
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                      : micDead
                        ? "animate-pulse bg-amber-400"
                        : "bg-white/40"
                )}
              />
              {statusLabel()}
              {engineLabel ? ` · ${engineLabel}` : ""}
              {aiEnabled ? " · GPT" : ""}
              {aiVoiceOn && heyNova ? " · Voice ON" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleHeyNova}
                className={cn(
                  "h-8 gap-1.5 rounded-lg px-2 text-xs font-semibold text-white/90 hover:bg-white/15",
                  heyNova && micReady && "bg-white/20 ring-1 ring-emerald-300/60"
                )}
              >
                <Radio className={cn("h-3.5 w-3.5", heyNova && micReady && "text-emerald-200")} />
                Hey Maya
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {heyNova && micReady ? "Voice ON — say Hey Maya" : "Enable voice"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/90 hover:bg-white/15"
                onClick={() => (speaking ? stopNovaSpeech() : readLastReply())}
                disabled={messages.length < 2}
              >
                {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Read last answer</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-background/50 p-4">
        {!micReady && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-center dark:border-violet-800/60 dark:bg-violet-950/40">
            <p className="text-sm font-medium text-violet-900 dark:text-violet-100">
              {voiceNeedsResume ? "Voice was on — tap to resume" : "Hey Maya — tap once to enable"}
            </p>
            <p className="mt-1 text-xs text-violet-700 dark:text-violet-300">
              Phir bolo &quot;Hey Maya&quot; — voice active ho jayega
            </p>
            <Button
              type="button"
              className="mt-3 bg-violet-600 hover:bg-violet-700"
              onClick={enableListening}
            >
              <Radio className="mr-2 h-4 w-4" />
              {voiceNeedsResume ? "Resume Hey Maya" : "Enable Hey Maya"}
            </Button>
          </div>
        )}

        {messages.map((m, i) => {
          const hasDashboard = m.blocks?.some(
            (b) => b.type === "department_dashboard" || b.type === "employee_dashboard"
          );
          return (
            <div
              key={i}
              className={cn(
                "flex gap-3",
                m.role === "user" ? "flex-row-reverse" : hasDashboard ? "w-full" : ""
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  m.role === "user"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                    : "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                )}
              >
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm",
                  m.role === "user"
                    ? "max-w-[85%] bg-emerald-600 text-white"
                    : hasDashboard
                      ? "min-w-0 max-w-full flex-1 bg-transparent p-0 ring-0"
                      : "max-w-[85%] bg-muted text-foreground ring-1 ring-border"
                )}
              >
                {m.role === "user" ? (
                  <p>{m.content}</p>
                ) : (
                  <ChatBlocks
                    blocks={m.blocks ?? [{ type: "text", content: m.content }]}
                    isAdmin={isAdmin}
                    unitId={unitId}
                  />
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50">
              <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
            </div>
            <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              {NOVA.name} is preparing your report…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-card p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              disabled={loading}
              className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground hover:border-violet-400/50 hover:bg-violet-500/10 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "h-11 w-11 shrink-0 rounded-xl border-border",
                  heyNova &&
                    micReady &&
                    "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 ring-2 ring-emerald-500/30 dark:text-emerald-400",
                  novaCapturing &&
                    "border-violet-500/50 bg-violet-500/10 text-violet-600 ring-2 ring-violet-500/30 dark:text-violet-400"
                )}
                onClick={handleMicButton}
                disabled={loading}
              >
                {novaCapturing ? (
                  <Mic className="h-4 w-4 animate-pulse" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {heyNova && micReady ? "Voice ON — tap to turn off" : "Tap once to enable"}
            </TooltipContent>
          </Tooltip>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={`${NOVA.name}, Bhupesh Sharma report…`}
            className={cn(
              "flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground",
              novaCapturing && "border-violet-500/50 ring-2 ring-violet-500/20"
            )}
          />

          <Button
            type="button"
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="h-11 rounded-xl bg-violet-600 px-4 hover:bg-violet-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {(voiceError || ttsError) && (
          <div className="mt-2 text-center">
            <p className="text-xs text-amber-600 dark:text-amber-400">{voiceError ?? ttsError}</p>
            <div className="mt-1 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setTtsError(null);
                  void enableListening();
                  window.setTimeout(() => startVoice(), 400);
                }}
                className="text-xs font-medium text-violet-600 underline dark:text-violet-400"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {heyNova && micReady && voicePhase === "awakened" && micListening && !voiceError && (
          <p className="mt-1 text-center text-xs font-medium text-violet-600 dark:text-violet-400">
            ● Active — ab apna sawaal bolo
          </p>
        )}
        {heyNova && micReady && micListening && voicePhase !== "awakened" && !voiceError && (
          <p className="mt-1 text-center text-[11px] text-emerald-600 dark:text-emerald-400">
            ● Sun rahi hoon — bolo <strong>&quot;Hey Maya&quot;</strong> ya <strong>&quot;Maya, report…&quot;</strong>
          </p>
        )}
        {micDead && !voiceError && (
          <p className="mt-1 text-center text-[11px] text-amber-600 dark:text-amber-400">
            ● Mic reconnect ho raha hai… thoda wait karein ya mic button dabayein
          </p>
        )}
        {heyNova && micReady && lastHeard && (
          <p className="mt-1 text-center text-[10px] text-muted-foreground">
            Suna: &quot;{lastHeard.slice(-80)}&quot;
          </p>
        )}
      </div>
    </div>
  );
}
