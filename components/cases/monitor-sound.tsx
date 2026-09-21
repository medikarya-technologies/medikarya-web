"use client"

// The bedside monitor's sound, off until the student turns it on: a short beep on every heartbeat (higher when the
// oxygen level is high, lower as it falls) and a three-tone alarm every few seconds while an alarm is showing. It is
// the cheapest way to make the bedside feel like a ward, and the easiest to get wrong, so:
//
//   - it is opt-in, remembered per device, and one button turns it off again;
//   - the beep comes from the ECG trace when the trace draws a beat, so it lands on the QRS you can see; when
//     nothing is drawing (a phone with the monitor closed) a timer at the patient's rate stands in;
//   - nothing plays while the tab is hidden, and there is nothing to beep to in ventricular fibrillation.
//
// One encounter is open at a time, so the state is a small module-level store rather than a provider.

import { useEffect, useSyncExternalStore } from "react"
import { Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"
import { ALARM_BURST, ALARM_EVERY_MS, beatIntervalMs, makesBeats, needsFallback, pulsePitch } from "@/lib/simulation/monitor-sound"
import { useClinicalEvents } from "./clinical-event-manager"

const KEY = "medikarya-monitor-sound"

const listeners = new Set<() => void>()
let loaded = false
let enabled = false
let context: AudioContext | null = null
let lastBeatAt = 0
let nextFallbackAt = 0
let nextAlarmAt = 0
let vitals = { rate: 70, spo2: 98, rhythm: "sinus_normal" as string, alarming: false }

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    enabled = localStorage.getItem(KEY) === "on"
  } catch {
    /* off */
  }
}

function audio(): AudioContext | null {
  if (context) return context
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    context = new Ctor()
  } catch {
    context = null
  }
  return context
}

function tone(freq: number, offsetMs: number, ms: number, gain: number, type: OscillatorType) {
  const ctx = audio()
  if (!ctx) return
  if (ctx.state === "suspended") void ctx.resume()
  const start = ctx.currentTime + offsetMs / 1000
  const end = start + ms / 1000
  const osc = ctx.createOscillator()
  const level = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  level.gain.setValueAtTime(0.0001, start)
  level.gain.exponentialRampToValueAtTime(gain, start + 0.006)
  level.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(level).connect(ctx.destination)
  osc.start(start)
  osc.stop(end + 0.02)
}

const beep = () => tone(pulsePitch(vitals.spo2), 0, 70, 0.07, "sine")

export const monitorSound = {
  isOn: () => {
    load()
    return enabled
  },

  set(on: boolean) {
    load()
    enabled = on
    try {
      localStorage.setItem(KEY, on ? "on" : "off")
    } catch {
      /* it lasts until the page is closed */
    }
    if (on) {
      lastBeatAt = performance.now()
      beep() // so the student hears that it works
    }
    listeners.forEach((notify) => notify())
  },

  /** Called by the ECG trace each time it draws a heartbeat. */
  onBeat: () => {
    if (!enabled || document.hidden) return
    lastBeatAt = performance.now()
    beep()
  },

  /** The latest state of the patient, for the tones. */
  setVitals(next: typeof vitals) {
    vitals = next
  },

  /** Run about ten times a second while the sound is on: the timer beeps and the alarm. */
  tick() {
    if (!enabled || document.hidden) return
    const now = performance.now()
    if (makesBeats(vitals.rhythm, vitals.rate) && needsFallback(now - lastBeatAt, vitals.rate) && now >= nextFallbackAt) {
      beep()
      nextFallbackAt = now + beatIntervalMs(vitals.rate)
    }
    if (!vitals.alarming) {
      nextAlarmAt = 0
    } else if (now >= nextAlarmAt) {
      for (const n of ALARM_BURST) tone(n.freq, n.at, n.ms, 0.05, "square")
      nextAlarmAt = now + ALARM_EVERY_MS
    }
  },
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useMonitorSoundOn(): boolean {
  return useSyncExternalStore(subscribe, monitorSound.isOn, () => false)
}

/** Mounted with the encounter: keeps the tones in step with the patient. Renders nothing. */
export function MonitorSoundDriver() {
  const { patient } = useClinicalEvents()
  const on = useMonitorSoundOn()
  monitorSound.setVitals({ rate: patient.rate, spo2: patient.spo2, rhythm: patient.rhythm, alarming: patient.alarms.length > 0 })

  useEffect(() => {
    if (!on) return
    const timer = window.setInterval(monitorSound.tick, 100)
    // A browser starts audio only after the student has done something on the page: this wakes it on the first touch.
    const wake = () => void context?.resume()
    window.addEventListener("pointerdown", wake, { once: true })
    window.addEventListener("keydown", wake, { once: true })
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("pointerdown", wake)
      window.removeEventListener("keydown", wake)
    }
  }, [on])

  return null
}

/** The speaker button on the monitor. */
export function SoundToggle({ className }: { className?: string }) {
  const on = useMonitorSoundOn()
  return (
    <button
      type="button"
      onClick={() => monitorSound.set(!on)}
      aria-pressed={on}
      aria-label={on ? "Turn the monitor sound off" : "Turn the monitor sound on"}
      title={on ? "Monitor sound on. Click to turn off." : "Turn the monitor sound on"}
      className={cn("flex h-6 w-6 items-center justify-center rounded text-enc-scope-dim outline-none transition-colors hover:text-enc-nibp focus-visible:ring-2 focus-visible:ring-brand-300", on && "text-enc-ecg", className)}
    >
      {on ? <Volume2 className="h-3.5 w-3.5" strokeWidth={2} /> : <VolumeX className="h-3.5 w-3.5" strokeWidth={2} />}
    </button>
  )
}
