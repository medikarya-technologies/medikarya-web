import type { CurrentCondition } from "../../../../engine/chatEngine";

// The patient's current state comes from the browser (the live simulation runs there) and is written into the
// prompt, so only the expected shape gets through: a known consciousness level and a short observation.
const CONSCIOUSNESS = new Set(["alert", "anxious", "drowsy", "altered", "unresponsive"]);

export function cleanCondition(value: unknown): CurrentCondition | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { observation, consciousness } = value as Record<string, unknown>;
  const clean: CurrentCondition = {};
  if (typeof observation === "string" && observation.trim()) clean.observation = observation.trim().slice(0, 300);
  if (typeof consciousness === "string" && CONSCIOUSNESS.has(consciousness)) clean.consciousness = consciousness;
  return clean.observation || clean.consciousness ? clean : undefined;
}

/** A question to the patient; long enough for any real one. */
export const MAX_MESSAGE_LENGTH = 1000;
