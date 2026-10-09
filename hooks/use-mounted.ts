"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * false on the server and while the page is being hydrated, true from the next render on. For parts that can only be
 * drawn in the browser, such as Clerk's sign-in box: Clerk often finishes loading before React hydrates, so it draws
 * on the browser's first render but not the server's, and React reports a hydration mismatch. Drawing them only once
 * this is true keeps the first browser render the same as the server's.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}
