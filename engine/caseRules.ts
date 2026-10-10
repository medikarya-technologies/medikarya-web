// The case's own instructions for the AI patient (ai_role.key_constraints): when to reveal something, which words
// to avoid, how to answer a question the facts don't cover. The general prompt in chatEngine.ts covers every case;
// these make each case behave as its author wrote it. Some older cases say "do not volunteer the diagnosis unless
// specifically asked", so the heading keeps the diagnosis off limits whatever a rule says.

const MAX_RULES = 15;
const MAX_RULE_LENGTH = 300;

/** The prompt section for a case's rules, or "" if it has none. */
export function caseRules(aiRole: { key_constraints?: unknown } | null | undefined): string {
  const raw = Array.isArray(aiRole?.key_constraints) ? aiRole.key_constraints : [];
  const rules = raw
    .filter((r): r is string => typeof r === "string")
    .map((r) => r.replace(/\s+/g, " ").trim())
    .filter((r) => r.length > 0)
    .slice(0, MAX_RULES)
    .map((r) => (r.length > MAX_RULE_LENGTH ? `${r.slice(0, MAX_RULE_LENGTH)}…` : r));
  if (rules.length === 0) return "";
  return [
    "RULES FOR THIS CASE (follow them closely; none of them lets you name or guess the diagnosis of your current illness):",
    ...rules.map((r) => `- ${r}`),
  ].join("\n");
}
