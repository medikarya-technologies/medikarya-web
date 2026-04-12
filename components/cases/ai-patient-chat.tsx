"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Loader2, User, Mic, MicOff } from "lucide-react"
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
}

// Rotated in groups of 3 — slightly incomplete to prompt thinking
const SUGGESTED_QUESTION_SETS = [
  [
    "How long has this been going on?",
    "Is there any blood in the stools?",
    "How is the child's urine output?",
  ],
  [
    "Any fever or chills?",
    "Has this happened before?",
    "What does the vomit look like?",
  ],
  [
    "Any contact with someone who had similar symptoms?",
    "Are vaccinations up to date?",
    "Is the child drinking fluids?",
  ],
]

export function AIPatientChat({ caseData, onMessageSent, chatHistory, coverage }: AIPatientChatProps) {
  const [openingLoading, setOpeningLoading] = useState(true)

  // Rotate suggestion set based on user message count
  const userMsgCount = (chatHistory || []).filter(m => m.role === "user").length
  const suggestionSet = SUGGESTED_QUESTION_SETS[Math.floor(userMsgCount / 3) % SUGGESTED_QUESTION_SETS.length]

  const [messages, setMessages] = useState<Message[]>(() => {
    if (chatHistory && chatHistory.length > 0) {
      return chatHistory.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }))
    }
    return []
  })

  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end"
    })
  }, [messages])

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
      body: JSON.stringify({ caseData })
    })
      .then(r => r.json())
      .then(data => {
        const openingMsg: Message = {
          id: "welcome",
          role: "assistant",
          content: data.opening || "Doctor, I need your help.",
          timestamp: new Date()
        }
        setMessages([openingMsg])
        onMessageSent(openingMsg)
      })
      .catch(() => {
        const fallback: Message = {
          id: "welcome",
          role: "assistant",
          content: "Doctor, I really need your help.",
          timestamp: new Date()
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
        setInput(prev => {
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
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    onMessageSent(userMessage)
    trackEvent("Message_Sent")
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content, caseData, chatHistory: messages })
      })
      if (!response.ok) throw new Error("Failed")
      const data = await response.json()
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
      onMessageSent(assistantMessage)
    } catch {
      const fallback: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm not sure about that, Doctor. Is that important for my child's condition?",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, fallback])
      onMessageSent(fallback)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const userQuestions = messages.filter(m => m.role === "user").length

  return (
    <div className="flex flex-col h-[500px] sm:h-[550px] md:h-[600px] min-h-0">

      {/* ── Chat area ─────────────────────────────────────────────── */}
      <div
        className="flex-1 min-h-0 w-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
        ref={scrollAreaRef}
        style={{ scrollbarWidth: 'thin' }}
        data-lenis-prevent
      >
        {/* Counter strip */}
        <div className="sticky top-0 z-10 px-3 py-1.5 bg-blue-50/80 backdrop-blur-sm border-b border-blue-100 flex items-center justify-between">
          <span className="text-[10px] text-blue-600 font-medium">
            {userQuestions === 0
              ? "Ask your first question to begin history taking"
              : `${userQuestions} question${userQuestions !== 1 ? "s" : ""} asked`}
          </span>
          {coverage && (
            <div className="flex gap-0.5 items-center">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={cn(
                    "h-1 w-4 rounded-full transition-all duration-500",
                    i < coverage.score ? "bg-blue-500" : "bg-blue-200"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-3 space-y-3">
          {messages.map(message => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-blue-600 text-white">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                  message.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
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
                <AvatarFallback className="bg-blue-600 text-white">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-slate-100 border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2">
                <span className="flex gap-1 items-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input area ─────────────────────────────────────────────── */}
      <div className="border-t border-slate-200 p-3 space-y-2 bg-white">

        {/* Rotating suggestion pills — 3 at a time */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {suggestionSet.map((question, index) => (
            <button
              key={`${Math.floor(userMsgCount / 3)}-${index}`}
              onClick={() => {
                setInput(question)
                trackEvent("Suggested_Question_Clicked")
              }}
              className="whitespace-nowrap rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200 flex-shrink-0"
            >
              {question}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask the patient a question..."
            disabled={isLoading}
            className="flex-1 bg-slate-50 border-slate-200 focus:border-blue-300 focus:ring-blue-100"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={toggleListening}
            className={cn(
              "shrink-0 border-slate-200",
              isListening && "bg-red-100 text-red-600 border-red-200 hover:bg-red-200 hover:text-red-700"
            )}
            title={isListening ? "Stop listening" : "Start listening"}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
