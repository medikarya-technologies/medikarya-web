"use client"

// The two controls for light and dark: a small icon button that flips it (rail, encounter top bar), and the
// three-way choice with "system" (Profile). Both read and write the same stored choice (theme-controller.tsx).

import { Monitor, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { setThemePreference, useIsDark, useThemePreference } from "./theme-controller"

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useIsDark()
  return (
    <button
      type="button"
      onClick={() => setThemePreference(dark ? "light" : "dark")}
      title={dark ? "Switch to light" : "Switch to dark, easier on the eyes at night"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-enc-ink-3 outline-none transition-colors hover:bg-enc-console-hover hover:text-enc-ink focus-visible:ring-2 focus-visible:ring-brand-300", className)}
    >
      {dark ? <Sun className="h-4 w-4" strokeWidth={1.9} /> : <Moon className="h-4 w-4" strokeWidth={1.9} />}
    </button>
  )
}

const CHOICES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

export function ThemeChoice() {
  const preference = useThemePreference()
  return (
    <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-1 rounded-lg bg-enc-console p-1">
      {CHOICES.map(({ value, label, icon: Icon }) => {
        const chosen = preference === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={chosen}
            onClick={() => setThemePreference(value)}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-300",
              chosen ? "bg-enc-sheet text-enc-ink shadow-enc-sheet" : "text-enc-ink-2 hover:text-enc-ink"
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
