"use client"

// "Wait and watch": skip the clock forward by a chosen amount. It stops early at a nurse alert, and then says what
// happened while the student waited (how long really passed, what changed on the monitor, which results came back).

import { useState } from "react"
import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatSpan, waitSteps, type SkipSummary } from "@/lib/simulation/time-skip"
import { useClinicalEvents } from "./clinical-event-manager"
import { useTimeSkip } from "./use-time-skip"

export function TimeSkipSummary({ summary, className }: { summary: SkipSummary; className?: string }) {
  return (
    <div role="status" className={cn("rounded-lg border border-enc-line bg-enc-sheet px-3 py-2 text-[12px] leading-snug text-enc-ink-2", className)}>
      <p className="font-medium text-enc-ink">{summary.title}</p>
      {summary.lines.map((line) => (
        <p key={line} className="mt-0.5">
          {line}
        </p>
      ))}
    </div>
  )
}

export function TimeSkipControl({ onSkipped, className }: { onSkipped?: () => void; className?: string }) {
  const { limitSeconds, now, isExpired } = useClinicalEvents()
  const skip = useTimeSkip()
  const [summary, setSummary] = useState<SkipSummary | null>(null)
  const steps = waitSteps(limitSeconds, now)
  if (steps.length === 0) return null

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 flex items-center gap-1 text-[12px] font-medium text-enc-ink-2">
          <Clock className="h-3.5 w-3.5" /> Wait and watch
        </span>
        {steps.map((m) => (
          <Button
            key={m}
            type="button"
            size="sm"
            variant="outline"
            disabled={isExpired}
            onClick={() => {
              setSummary(skip(m * 60))
              onSkipped?.()
            }}
            className="h-7 px-2.5 text-[11px]"
          >
            {formatSpan(m * 60)}
          </Button>
        ))}
      </div>
      {summary && <TimeSkipSummary summary={summary} className="mt-2" />}
    </div>
  )
}
