"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Loader2, User, Mic, MicOff, Lightbulb, X } from "lucide-react"
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
}

// Two icebreaker chips shown only before the student sends their first message
const ICEBREAKERS = [
  "Tell me what's been bothering you.",
  "How long has this been going on?",
]

export function AIPatientChat({ caseData, onMessageSent, chatHistory, coverage, adaptiveNudge }: AIPatientChatProps) {
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
