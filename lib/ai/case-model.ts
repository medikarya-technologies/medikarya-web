import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { claudeJson } from "./claude";

// The model behind the admin's AI work on cases: converting a studio case sheet (lib/studio/convert.ts) and drafting
// a live plan (lib/studio/live-draft.ts). Gemini by default (GEMINI_API_KEY, billed to Google AI Studio credit).
// Set CASE_AI=claude to use Claude instead (lib/ai/claude.ts; needs Claude Console API credit, not a Pro plan).

const GEMINI_MODEL = "gemini-3.8-flash";

export function caseModelName(): string {
  return process.env.CASE_AI === "claude" ? "Claude" : "Gemini";
}

function parseJson(text: string): any {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The AI did not return a JSON object. Try again.");
  return JSON.parse(text.slice(start, end + 1));
}

async function geminiJson(system: string, prompt: string, opts: { maxTokens: number; temperature: number }): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: system,
    generationConfig: { temperature: opts.temperature, responseMimeType: "application/json", maxOutputTokens: opts.maxTokens },
  });
  // Gemini now and then breaks its own JSON (a stray quote in a long answer): ask once more before giving up.
  for (let attempt = 1; ; attempt++) {
    const result = await model.generateContent(prompt);
    try {
      return parseJson(result.response.text());
    } catch (error) {
      if (attempt >= 2) throw new Error("The AI's answer was not valid JSON twice in a row. Try again.");
      console.warn("Gemini returned invalid JSON; asking again.", error);
    }
  }
}

/** One request whose answer is a single JSON object: `system` is the standing instructions, `prompt` is this case. */
export function caseModelJson(system: string, prompt: string, opts: { maxTokens: number; temperature: number }): Promise<any> {
  return process.env.CASE_AI === "claude"
    ? claudeJson(system, prompt, { maxTokens: Math.max(opts.maxTokens, 24000), effort: "medium" })
    : geminiJson(system, prompt, opts);
}
