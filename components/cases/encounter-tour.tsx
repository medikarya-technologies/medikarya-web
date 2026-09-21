"use client"

// The walk through the bedside encounter: where to type, where to examine, where tests are ordered, where to
// step in when the patient gets worse, and where the answer is given. It points at controls by their
// `data-tour` names (set in encounter-chrome.tsx, bedside-patient-rail.tsx and ai-patient-chat.tsx), so a step
// whose control is not on this screen is simply left out.
//
// It starts by itself once, for a student on their first case (see lib/tour/tour-storage.ts); the ? in the
// top bar replays it. The encounter's clock is frozen while it is open (simulation-interaction.tsx).

import { GuidedTour, type TourEnd, type TourStep } from "@/components/tour/guided-tour"

const STEPS: TourStep[] = [
  {
    id: "patient",
    target: "patient",
    title: "This is your patient",
    body: "The monitor shows their vitals, live. They change if the patient gets worse, or better with what you do. The clock is the encounter's own time: it waits while you are away, and while this tour is open.",
  },
  {
    id: "history",
    target: "chat-input",
    title: "Type here to talk to the patient",
    body: "Ask what you would ask at the bedside, in your own words. Every question and every answer goes on your record.",
  },
  {
    id: "exam",
    target: "tab-exam",
    title: "Examine",
    body: "Choose what to examine. Findings come back straight away and are added to your record.",
  },
  {
    id: "tests",
    target: "tab-tests",
    title: "Order tests from here",
    body: "Pick from the list of investigations. Results take time to come back on the encounter clock, and a badge on this tab tells you when one is ready to read.",
  },
  {
    id: "intervene",
    target: "intervene",
    title: "Intervene from here",
    body: "If the patient gets worse, this is where you treat them. It is always in the top bar, and it stands out when the patient is critical.",
  },
  {
    id: "diagnose",
    target: "tab-diagnose",
    title: "Diagnose when you are ready",
    body: (
      <>
        Rank your differential, name your diagnosis and give your plan. You get feedback on every step, not only the answer.
        <span className="mt-2 block text-enc-ink-3">You can take this tour again from the top bar (the ⋯ menu on a phone).</span>
      </>
    ),
  },
]

export function EncounterTour({ open, onClose }: { open: boolean; onClose: (how: TourEnd) => void }) {
  return <GuidedTour steps={STEPS} open={open} onClose={onClose} />
}
