/** Whether an attempt's score still uses fallback grading and must not count as final. */
export function isProvisionalAttempt(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const flag = row.provisional ?? (row.feedback_json && typeof row.feedback_json === "object"
    ? (row.feedback_json as Record<string, unknown>).provisional
    : undefined);
  return flag === true || flag === "true";
}
