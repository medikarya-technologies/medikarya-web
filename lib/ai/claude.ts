import "server-only";

import Anthropic from "@anthropic-ai/sdk";

// Claude, for the admin's AI work on cases when CASE_AI=claude (lib/ai/case-model.ts; Gemini otherwise). The key is
// CLAUDE_API_KEY, billed to Claude Console API credit (not a Claude Pro plan or its cloud session credit).

export const CLAUDE_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;

function claude(): Anthropic {
  if (client) return client;
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY is not set (add it to .env.local, and on Vercel).");
  // A key made outside a workspace has to name one on every request (CLAUDE_WORKSPACE_ID, from the Claude Console's
  // Workspaces page). A key made inside a workspace needs nothing more.
  const workspace = process.env.CLAUDE_WORKSPACE_ID?.trim();
  client = new Anthropic({ apiKey, ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}) });
  return client;
}

/** The JSON object in a reply, even if the model wrapped it in a code fence or a sentence. */
function parseJson(text: string): any {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The AI did not return a JSON object. Try again.");
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * One request whose answer is a single JSON object. `system` is the standing instructions (cached, so a retry or the
 * next case costs less); `prompt` is this case. Streamed, because a whole case is a long answer.
 */
export async function claudeJson(system: string, prompt: string, opts: { maxTokens: number; effort?: "low" | "medium" | "high" }): Promise<any> {
  const stream = claude().beta.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens,
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? "medium" },
    // if a safety check declines (medical content can trip one), the API retries on another model in the same call
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") throw new Error("The AI declined to write this case. Try again, or convert it by hand.");
  if (message.stop_reason === "max_tokens") throw new Error("The AI's answer was cut off before it finished. Try again.");
  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return parseJson(text);
}
