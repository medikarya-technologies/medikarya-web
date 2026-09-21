"use client"

// Applies the student's light/dark choice to the page, and lets the rest of the app read and change it. The
// choice lives in localStorage; the class on <html> is what the styles follow (`.dark`, in app/globals.css).
// The very first paint is handled by the script in the root layout (lib/theme.ts). This keeps it right after
// that: when the student changes it, when the device's own setting changes under "system", when they go
// between the app and the marketing pages, and when another tab changes it.

import { useEffect, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import { THEME_KEY, parsePreference, wantsDark, type ThemePreference } from "@/lib/theme"

const listeners = new Set<() => void>()
// If the browser will not store it, the choice still lasts until the page is closed.
let remembered: ThemePreference | null = null

function readPreference(): ThemePreference {
  if (remembered) return remembered
  try {
    return parsePreference(localStorage.getItem(THEME_KEY))
  } catch {
    return "light"
  }
}

function apply() {
  const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  document.documentElement.classList.toggle("dark", wantsDark(readPreference(), systemIsDark, window.location.pathname))
}

export function setThemePreference(preference: ThemePreference) {
  remembered = preference
  try {
    localStorage.setItem(THEME_KEY, preference)
    remembered = null
  } catch {
    /* kept in `remembered` */
  }
  apply()
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY) return
    apply()
    notify()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(notify)
    window.removeEventListener("storage", onStorage)
  }
}

/** The stored choice: light, dark or system. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readPreference, () => "light")
}

/** Whether the page is dark right now (what an icon should show), following the class on <html>. */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const watch = new MutationObserver(notify)
      watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
      return () => watch.disconnect()
    },
    () => document.documentElement.classList.contains("dark"),
    () => false
  )
}

/** Mounted once in the root layout: keeps the class on <html> in step with everything above. */
export function ThemeController() {
  const pathname = usePathname()
  useEffect(() => {
    apply()
  }, [pathname])
  useEffect(() => {
    const device = window.matchMedia("(prefers-color-scheme: dark)")
    device.addEventListener("change", apply)
    return () => device.removeEventListener("change", apply)
  }, [])
  return null
}
