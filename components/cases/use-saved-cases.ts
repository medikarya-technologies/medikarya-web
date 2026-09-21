"use client"

// The cases this student has saved for later, read from the browser (see lib/library/saved.ts) and kept in step
// between the page and other tabs. If the browser will not keep the list, it still lasts until the page is closed.

import { useCallback, useMemo, useSyncExternalStore } from "react"
import { parseSaved, readSaved, savedKeyFor, serialiseSaved, toggleSaved, writeSaved } from "@/lib/library/saved"

const listeners = new Set<() => void>()
const unkept = new Map<string, string[]>()

function subscribe(notify: () => void) {
  listeners.add(notify)
  window.addEventListener("storage", notify)
  return () => {
    listeners.delete(notify)
    window.removeEventListener("storage", notify)
  }
}

export function useSavedCases(scope?: string): { saved: ReadonlySet<string>; toggle: (id: string) => void } {
  const key = savedKeyFor(scope)
  // The list as text is what React watches: text compares by value, so nothing re-renders unless the list changed.
  const raw = useSyncExternalStore(
    subscribe,
    () => serialiseSaved(unkept.get(key) ?? readSaved(scope)),
    () => "[]"
  )
  const saved = useMemo<ReadonlySet<string>>(() => new Set(parseSaved(raw)), [raw])

  const toggle = useCallback(
    (id: string) => {
      const next = toggleSaved(unkept.get(key) ?? readSaved(scope), id)
      if (writeSaved(next, scope)) unkept.delete(key)
      else unkept.set(key, next)
      listeners.forEach((notify) => notify())
    },
    [key, scope]
  )

  return { saved, toggle }
}
