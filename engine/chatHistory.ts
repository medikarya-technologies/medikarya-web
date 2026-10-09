// The conversation so far, as the browser sends it with each question to the AI patient (engine/chatEngine.ts).
//
// The server keeps no copy of its own. It used to, in memory, which broke whenever the site ran on more than one
// server (a busy room of students: the next question reached a server that had never seen the conversation), on
// every restart, for retried cases (the old attempt was still there), and for signed-out visitors, who all shared
// one conversation. The browser already holds the whole conversation on screen, so it sends it.
//
// It comes from the browser, so only the expected shape gets through, and only so much of it: enough for a whole
// case, never enough to run up the AI bill with a hand-made request.

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const HISTORY_LIMITS = {
  /** Turns kept (a question and its answer are two): about 20 exchanges, the length of a full case. */
  turns: 40,
  /** One turn: questions are capped at 1,000 characters already; the patient answers in a sentence. */
  turnChars: 1000,
  /** All turns together, so many long turns cannot add up. */
  totalChars: 12_000,
} as const;

/** The newest part of the conversation the browser sent, cleaned: oldest turns go first when it is too long. */
export function cleanChatHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];

  const turns: ChatTurn[] = [];
  // only the end of a long array is ever kept, so the rest is not even looked at
  for (const item of value.slice(-HISTORY_LIMITS.turns * 2)) {
    if (!item || typeof item !== "object") continue;
    const { role, content } = item as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.trim().slice(0, HISTORY_LIMITS.turnChars);
    if (!text) continue;
    const last = turns[turns.length - 1];
    // two turns in a row from the same side (say, a question that got no answer) become one
    if (last && last.role === role) last.content = `${last.content}\n${text}`.slice(0, HISTORY_LIMITS.turnChars);
    else turns.push({ role, content: text });
  }

  // a question that was never answered is dropped: the doctor is asking again now
  while (turns.length && turns[turns.length - 1].role === "user") turns.pop();

  let kept = turns.slice(-HISTORY_LIMITS.turns);
  let total = kept.reduce((sum, t) => sum + t.content.length, 0);
  while (kept.length && total > HISTORY_LIMITS.totalChars) {
    total -= kept[0].content.length;
    kept = kept.slice(1);
  }
  return kept;
}

/** What opens a conversation that begins with the patient's own first words, since the AI's history must start with the doctor. */
export const DOCTOR_ENTERS = "(The doctor comes in and sits down.)";

/** The conversation in the shape the Gemini chat takes: roles "user" (the doctor) and "model" (the patient), starting with the doctor. */
export function toGeminiHistory(turns: readonly ChatTurn[]): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  const opening = turns[0]?.role === "assistant" ? [{ role: "user" as const, parts: [{ text: DOCTOR_ENTERS }] }] : [];
  return [...opening, ...turns.map((t) => ({ role: t.role === "assistant" ? ("model" as const) : ("user" as const), parts: [{ text: t.content }] }))];
}
