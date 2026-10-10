// The case's patient_facts as the AI patient reads them. Most facts are grouped (identity, symptoms, timeline,
// drug_history: objects and lists inside objects), and writing each group straight into a template string turned it
// into "[object Object]", so the patient never saw them, and the prompt tells it to deny anything it was not given.
//
// Examination findings are left out: they are what the doctor finds, and the student meets them by examining. A
// patient does not know their own reflexes, and could otherwise give findings away in the chat.

const MAX_DEPTH = 4;

const label = (key: string) => key.replace(/_/g, " ");
const isExamination = (key: string) => /(^|_)examination$/.test(key);

function lines(value: unknown, indent: string, depth: number): string[] {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value !== "object") return [`${indent}${String(value)}`];
  if (depth >= MAX_DEPTH) return [`${indent}${JSON.stringify(value)}`];

  if (Array.isArray(value)) {
    const items = value.filter((v) => v !== null && v !== undefined && v !== "");
    if (items.every((v) => typeof v !== "object")) return items.length ? [`${indent}${items.join(", ")}`] : [];
    return items.flatMap((v) => {
      const [first, ...rest] = lines(v, `${indent}  `, depth + 1);
      return first === undefined ? [] : [`${indent}- ${first.trimStart()}`, ...rest];
    });
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, v]) => {
    const inner = lines(v, `${indent}  `, depth + 1);
    if (inner.length === 0) return [];
    // a single short value stays on its key's line ("smoking: Five cigarettes a day")
    if (inner.length === 1 && (typeof v !== "object" || Array.isArray(v))) return [`${indent}${label(key)}: ${inner[0].trimStart()}`];
    return [`${indent}${label(key)}:`, ...inner];
  });
}

/** patient_facts as readable lines for the prompt, without the examination; "" when there is nothing. */
export function patientFactsText(facts: unknown): string {
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) return "";
  const kept = Object.fromEntries(Object.entries(facts as Record<string, unknown>).filter(([key]) => !isExamination(key)));
  return lines(kept, "", 0).join("\n");
}
