"use client"

// Which cases the student has started on this device and not finished. The encounter keeps itself in the
// browser (see lib/simulation/resume.ts), so the server cannot know: this reads it after the page has loaded,
// and again when the page is shown or another tab changes it (finish a case in one tab and the library in
// another stops calling it in progress).

import { useEffect, useState } from "react"
import { readAllInProgress, type InProgress } from "@/lib/simulation/resume"

const NONE: ReadonlyMap<string, InProgress> = new Map()

function same(a: ReadonlyMap<string, InProgress>, b: ReadonlyMap<string, InProgress>): boolean {
  if (a.size !== b.size) return false
  for (const [id, x] of a) {
    const y = b.get(id)
    if (!y || y.actions !== x.actions || y.elapsedSeconds !== x.elapsedSeconds || y.savedAt !== x.savedAt) return false
  }
  return true
}

export function useInProgress(caseIds: readonly string[]): ReadonlyMap<string, InProgress> {
  const [found, setFound] = useState<ReadonlyMap<string, InProgress>>(NONE)
  const key = caseIds.join("|")

  useEffect(() => {
    const ids = key ? key.split("|") : []
    const read = () =>
      setFound((prev) => {
        const next = readAllInProgress(ids)
        return same(prev, next) ? prev : next
      })
    read()
    window.addEventListener("storage", read)
    window.addEventListener("focus", read)
    window.addEventListener("pageshow", read)
    return () => {
      window.removeEventListener("storage", read)
      window.removeEventListener("focus", read)
      window.removeEventListener("pageshow", read)
    }
  }, [key])

  return found
}
