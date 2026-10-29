"use client"

// Skipping time at the bedside, from anywhere on the encounter screen: the clock control in the patient rail, the
// "Skip to result" button on a pending test, and the wait row in the intervention tray all go through here, so each
// one stops at a nurse alert (the engine's skipTime does that) and tells the student what changed while they waited.

import { useCallback } from "react"
import { listOrders, readyAt } from "@/lib/simulation/case-resolvers"
import { describeSkip, type SkipSummary } from "@/lib/simulation/time-skip"
import { useClinicalEvents } from "./clinical-event-manager"

export function useTimeSkip(): (seconds: number) => SkipSummary | null {
  const { config, engine, actions, isExpired } = useClinicalEvents()

  return useCallback(
    (seconds: number) => {
      if (isExpired || !(seconds > 0)) return null
      const before = engine.state.snapshot()
      const pending = listOrders(engine.events)
      const { to, stopped } = actions.wait(seconds / 60)
      // The engine logs where the wait really began (it never starts before the last event).
      const last = engine.events.at(-1)
      const from = last?.type === "TIME_SKIPPED" ? last.from : to
      const resultsBack = pending.filter((o) => readyAt(config, o) > from && readyAt(config, o) <= to).map((o) => o.testName)
      return describeSkip({
        from,
        to,
        stopped,
        before,
        after: engine.state.snapshot(),
        resultsBack,
        unmeasured: config.initial_state?.unmeasured,
      })
    },
    [config, engine, actions, isExpired]
  )
}
