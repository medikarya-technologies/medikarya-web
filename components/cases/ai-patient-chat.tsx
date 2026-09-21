"use client"

import { useState, useRef, useEffect, type ReactNode, type RefObject } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Loader2, User, Mic, MicOff, Lightbulb, X, ArrowUpRight, CornerDownLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/clarity"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface HistoryCoverage {
  symptomsExplored: boolean
  durationAsked: boolean
  associatedSymptomsAsked: boolean
  redFlagsChecked: boolean
  score: number
}

interface AIPatientChatProps {
  caseData: any
  onMessageSent: (message: Message) => void
  chatHistory?: Message[]
  coverage?: HistoryCoverage
  adaptiveNudge?: string | null
  /**
   * "bedside" is the encounter workspace's own layout (a transcript on the desk, a docked
   * composer with the suggested questions above it). The classic layout is unchanged.
   */
  variant?: "classic" | "bedside"
  /** Bedside layout: who is speaking, and their portrait beside each of their lines. */
  patientName?: string
  patientAvatar?: ReactNode
}

// Two icebreaker chips shown only before the student sends their first message
const ICEBREAKERS = [
  "Tell me what's been bothering you.",
  "How long has this been going on?",
]

export function AIPatientChat({ caseData, onMessageSent, chatHistory, coverage, adaptiveNudge, variant = "classic", patientName = "Patient", patientAvatar }: AIPatientChatProps) {
  const [openingLoading, setOpeningLoading] = useState(true)

  const userMsgCount = (chatHistory || []).filter((m) => m.role === "user").length
  const showIcebreakers = userMsgCount === 0

  const [messages, setMessages] = useState<Message[]>(() => {
    if (chatHistory && chatHistory.length > 0) {
      return chatHistory.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
    }
    return []
  })

  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(false)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Reset hint dismissed state when the nudge changes
  useEffect(() => {
    setHintDismissed(false)
  }, [adaptiveNudge])

  // Fetch LLM-generated emotional opening on mount
  useEffect(() => {
    if (chatHistory && chatHistory.length > 0) {
      setOpeningLoading(false)
      return
    }
    setOpeningLoading(true)
    fetch("/api/chat/patient/opening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseData }),
    })
      .then((r) => r.json())
      .then((data) => {
        const openingMsg: Message = {
          id: "welcome",
          role: "assistant",
          content: data.opening || "Doctor, I need your help.",
          timestamp: new Date(),
        }
        setMessages([openingMsg])
        onMessageSent(openingMsg)
      })
      .catch(() => {
        const fallback: Message = {
          id: "welcome",
          role: "assistant",
          content: "Doctor, I really need your help.",
          timestamp: new Date(),
        }
        setMessages([fallback])
        onMessageSent(fallback)
      })
      .finally(() => setOpeningLoading(false))
  }, [])

  /* ── Speech to text ─────────────────────────────────────────── */
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop()
    }
  }, [])

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert("Your browser does not support speech recognition. Please try Chrome or Edge.")
      return
    }
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onresult = (event) => {
      let finalTranscript = ""
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }
      if (finalTranscript) {
        setInput((prev) => {
          const needsSpace = prev.length > 0 && !prev.endsWith(" ")
          return prev + (needsSpace ? " " : "") + finalTranscript
        })
      }
    }
    recognition.start()
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    }
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    onMessageSent(userMessage)
    trackEvent("Message_Sent")
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content, caseData, chatHistory: messages }),
      })
      if (!response.ok) throw new Error("Failed")
      const data = await response.json()
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      onMessageSent(assistantMessage)
    } catch {
      const fallback: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm not sure about that, Doctor. Is that important for my child's condition?",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, fallback])
      onMessageSent(fallback)
    } finally {
      setIsLoading(false)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const showHint = adaptiveNudge && !hintDismissed

  if (variant === "bedside") {
    return (
      <BedsideChatView
        messages={messages}
        isLoading={isLoading || openingLoading}
        input={input}
        setInput={setInput}
        onSend={handleSendMessage}
        onKeyDown={handleKeyDown}
        showIcebreakers={showIcebreakers}
        onPick={(question) => {
          setInput(question)
          trackEvent("Suggested_Question_Clicked")
          inputRef.current?.focus()
        }}
        hint={showHint ? (adaptiveNudge ?? null) : null}
        onDismissHint={() => setHintDismissed(true)}
        isListening={isListening}
        onToggleListening={toggleListening}
        inputRef={inputRef}
        endRef={messagesEndRef}
        patientName={patientName}
        patientAvatar={patientAvatar}
      />
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Chat area (scrollable flex-1) ──────────────────────────── */}
      <div
        className="flex-1 min-h-0 w-full overflow-y-auto"
        ref={scrollAreaRef}
        style={{ scrollbarWidth: "thin" }}
        data-lenis-prevent
      >
        <div className="p-3 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex gap-2", message.role === "user" ? "justify-end" : "justify-start")}
            >
              {message.role === "assistant" && (
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-brand-600 text-white">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                  message.role === "user"
                    ? "bg-brand-600 text-white rounded-br-sm"
                    : "bg-slate-100 border border-slate-200 text-slate-800 rounded-bl-sm"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <span className="block text-[10px] opacity-50 mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))}

          {(isLoading || openingLoading) && (
            <div className="flex gap-2 items-center">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-brand-600 text-white">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-slate-100 border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2">
                <span className="flex gap-1 items-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input area (flex-shrink-0) ─────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-slate-100 bg-white">

        {/* Hint strip (above suggestion chips) */}
        {showHint && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-b border-amber-100 animate-in fade-in duration-200">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <p className="text-[11px] text-amber-800 flex-1 leading-snug">{adaptiveNudge}</p>
            <button
              onClick={() => setHintDismissed(true)}
              className="text-amber-400 hover:text-amber-600 flex-shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Suggestion chips — icebreakers only, disappear after first message */}
        {showIcebreakers && (
          <div className="flex gap-2 overflow-x-auto px-3 pt-2 pb-1 scrollbar-hide">
            {ICEBREAKERS.map((question, index) => (
              <button
                key={index}
                onClick={() => {
                  setInput(question)
                  trackEvent("Suggested_Question_Clicked")
                }}
                className="whitespace-nowrap rounded-full bg-slate-50 px-3 py-1 text-[11px] text-slate-600 hover:bg-brand-50 hover:text-brand-700 transition-colors border border-slate-200 hover:border-brand-200 flex-shrink-0"
              >
                {question}
              </button>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-2 px-3 pb-3">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the patient a question…"
            disabled={isLoading}
            className="flex-1 bg-slate-50 border-slate-200 focus:border-brand-300 focus:ring-brand-100 text-sm h-9"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={toggleListening}
            className={cn(
              "shrink-0 h-9 w-9 border-slate-200",
              isListening && "bg-rose-100 text-rose-600 border-rose-200 hover:bg-rose-200"
            )}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-brand-600 hover:bg-brand-700 text-white h-9 px-3"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Bedside layout ──────────────────────────────────────────────────────────
// Two surfaces: the transcript on the desk (patient lines on white paper, yours in the
// accent tint), and the composer docked below it. The suggested questions live in the
// dock, labelled, so they read as prompts and never as part of the conversation.

interface BedsideChatViewProps {
  messages: Message[]
  isLoading: boolean
  input: string
  setInput: (value: string) => void
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  showIcebreakers: boolean
  onPick: (question: string) => void
  hint: string | null
  onDismissHint: () => void
  isListening: boolean
  onToggleListening: () => void
  inputRef: RefObject<HTMLInputElement | null>
  endRef: RefObject<HTMLDivElement | null>
  patientName: string
  patientAvatar?: ReactNode
}

const clock = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

function BedsideChatView({
  messages,
  isLoading,
  input,
  setInput,
  onSend,
  onKeyDown,
  showIcebreakers,
  onPick,
  hint,
  onDismissHint,
  isListening,
  onToggleListening,
  inputRef,
  endRef,
  patientName,
  patientAvatar,
}: BedsideChatViewProps) {
  const avatar = (
    <div className="mb-0.5 h-8 w-8 shrink-0">
      {patientAvatar ?? (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-enc-console text-enc-ink-3">
          <User className="h-4 w-4" />
        </span>
      )}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-enc-desk">
      {/* ── Transcript ──────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }} data-lenis-prevent>
        <div className="mx-auto w-full max-w-[760px] space-y-5 px-5 py-6">
          {messages.length > 0 && (
            <div className="flex items-center gap-3 text-[11px] text-enc-ink-3">
              <span className="h-px flex-1 bg-enc-line-strong" />
              <span className="font-medium tracking-wide">Interview started {clock(messages[0].timestamp)}</span>
              <span className="h-px flex-1 bg-enc-line-strong" />
            </div>
          )}

          {messages.map((message) =>
            message.role === "assistant" ? (
              <div key={message.id} className="flex items-end gap-2.5">
                {avatar}
                <div className="max-w-[78%] min-w-0">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-[12px] font-semibold text-enc-ink">{patientName}</span>
                    <span className="font-mono text-[11px] text-enc-ink-3 tabular-nums">{clock(message.timestamp)}</span>
                  </div>
                  <div className="rounded-2xl rounded-bl-md border border-enc-line bg-enc-sheet px-4 py-2.5 text-[15px] leading-relaxed text-enc-ink shadow-enc-sheet">
                    <p className="break-words whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[78%] min-w-0">
                  <div className="mb-1 flex items-baseline justify-end gap-2">
                    <span className="font-mono text-[11px] text-enc-ink-3 tabular-nums">{clock(message.timestamp)}</span>
                    <span className="text-[12px] font-semibold text-enc-ink-2">You</span>
                  </div>
                  <div className="rounded-2xl rounded-br-md border border-brand-200 bg-brand-50 px-4 py-2.5 text-[15px] leading-relaxed text-enc-ink">
                    <p className="break-words whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              </div>
            )
          )}

          {isLoading && (
            <div className="flex items-end gap-2.5">
              {avatar}
              <div className="rounded-2xl rounded-bl-md border border-enc-line bg-enc-sheet px-4 py-3 shadow-enc-sheet" aria-label="The patient is answering">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-enc-ink-3" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-enc-ink-3" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-enc-ink-3" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* ── Composer dock ───────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-enc-line-strong bg-enc-sheet shadow-enc-dock">
        <div className="mx-auto w-full max-w-[760px] space-y-3 px-5 py-3.5">
          {hint && (
            <div className="flex items-start gap-2 rounded-lg border border-enc-warn/25 bg-enc-warn-soft px-3 py-2 text-[13px] leading-snug text-enc-warn">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1">{hint}</p>
              <button onClick={onDismissHint} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {showIcebreakers && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-[0.09em] text-enc-ink-3 uppercase">Suggested questions</p>
              <div className="flex flex-wrap gap-2">
                {ICEBREAKERS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => onPick(question)}
                    className="group inline-flex items-center gap-1.5 rounded-lg border border-enc-line-strong bg-enc-sheet px-3 py-1.5 text-[13px] text-enc-ink-2 transition-colors outline-none hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-300"
                  >
                    {question}
                    <ArrowUpRight className="h-3.5 w-3.5 text-enc-ink-3 group-hover:text-brand-600" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div data-tour="chat-input" className="flex items-center gap-1.5 rounded-xl border border-enc-line-strong bg-enc-sheet p-1.5 pl-4 shadow-enc-sheet transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask the patient a question…"
              disabled={isLoading}
              aria-label="Ask the patient a question"
              className="h-9 min-w-0 flex-1 bg-transparent text-[15px] text-enc-ink outline-none placeholder:text-enc-ink-3 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={onToggleListening}
              title={isListening ? "Stop listening" : "Start voice input"}
              aria-label={isListening ? "Stop listening" : "Start voice input"}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-enc-ink-3 transition-colors hover:bg-enc-console hover:text-enc-ink",
                isListening && "bg-enc-crit-soft text-enc-crit hover:bg-enc-crit-soft hover:text-enc-crit"
              )}
            >
              {isListening ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
            </button>
            <button
              type="button"
              onClick={onSend}
              disabled={!input.trim() || isLoading}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-enc-line-strong disabled:text-enc-ink-3"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </div>
          <p className="flex items-center gap-1 text-[11px] text-enc-ink-3">
            <CornerDownLeft className="h-3 w-3" /> Enter to send. Everything you ask and every answer you get is part of your record.
          </p>
        </div>
      </div>
    </div>
  )
}
