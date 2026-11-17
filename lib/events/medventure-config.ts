/** Public event details that are safe to use in client components as well as on the server. */
export const MEDVENTURE = {
  key: "medventure-2026",
  name: "Medventure Clinical Decision Challenge",
  date: "2026-11-18",
  venue: "Maulana Azad Medical College, New Delhi",
  pass: { plan: "intern" as const, days: 5, maxJoins: 60, openDays: 1 },
  roundTwo: {
    caseId: "61-year-old-man-with-severe-chest-pain-and-sweating",
    title: "61-year-old man with severe chest pain and sweating",
  },
  dryRun: { name: "Medventure Clinical Decision Challenge · Preflight", maxJoins: 5, days: 1 },
} as const
