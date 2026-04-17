/**
 * extractHistoryFacts
 *
 * Heuristic client-side extractor that reads an AI patient response and returns
 * a list of short clinical fact strings suitable for the sidebar "History gathered"
 * section.
 *
 * Design intent: This module is deliberately isolated so it can be swapped for an
 * API-backed extractor later without touching any other file. To upgrade:
 *   1. Replace the body of this function with a fetch('/api/chat/extract-facts', …)
 *   2. Everything else stays the same.
 *
 * @param message - The raw AI patient response string
 * @returns An array of 0–3 short fact strings (never throws)
 */
export function extractHistoryFacts(message: string): string[] {
  if (!message || message.length < 10) return []

  const text = message.toLowerCase()
  const facts: string[] = []

  // ── Duration mentions ─────────────────────────────────────────────────────
  const durationMatch = message.match(
    /(\d+)\s*(day|days|week|weeks|hour|hours|month|months)\s*(ago|now|since)?/i
  )
  if (durationMatch) {
    facts.push(`Duration: ${durationMatch[0].trim()}`)
  }

  // "since [time expression]"
  const sinceMatch = message.match(/since\s+([a-z0-9\s]{3,30})/i)
  if (sinceMatch && !durationMatch) {
    facts.push(`Onset: since ${sinceMatch[1].trim()}`)
  }

  // ── Symptom negations ─────────────────────────────────────────────────────
  const negations: [RegExp, string][] = [
    [/no blood|no bleeding|no bloody/i, "No blood in stool"],
    [/no fever|no temperature|afebrile/i, "Afebrile"],
    [/no vomit|not vomiting|no nausea/i, "No vomiting"],
    [/not eating|no appetite|poor appetite/i, "Reduced appetite"],
    [/no rash|no skin/i, "No rash"],
    [/no seizure|no fit/i, "No seizures"],
    [/no weight loss/i, "No weight loss"],
    [/no contact|no exposure/i, "No sick contacts"],
  ]
  for (const [pattern, label] of negations) {
    if (pattern.test(text)) {
      facts.push(label)
      if (facts.length >= 3) break
    }
  }

  // ── Symptom confirmations ─────────────────────────────────────────────────
  if (facts.length < 3) {
    const confirmations: [RegExp, string][] = [
      [/vomit|throwing up|vomiting/i, "Vomiting present"],
      [/diarrhea|diarrhoea|loose stool|watery stool/i, "Diarrhoea present"],
      [/fever|febrile|temperature/i, "Fever noted"],
      [/blood in stool|bloody stool|melena/i, "Blood in stool"],
      [/dehydrat|dry mouth|sunken|no urine|not urinating/i, "Signs of dehydration"],
      [/rash|skin lesion/i, "Rash present"],
      [/cough|cold|runny nose|congestion/i, "Respiratory symptoms"],
      [/pain|ache|cramp/i, "Pain reported"],
      [/wheez|shortness of breath|breathless/i, "Breathing difficulty"],
      [/seizure|fit|convulsion/i, "Seizure history"],
      [/vaccin|immunis|immuniz/i, "Vaccination history mentioned"],
      [/contact|exposure|sick/i, "Sick contact noted"],
    ]
    for (const [pattern, label] of confirmations) {
      if (pattern.test(text) && !facts.includes(label)) {
        facts.push(label)
        if (facts.length >= 3) break
      }
    }
  }

  // ── Severity descriptors ──────────────────────────────────────────────────
  if (facts.length < 3) {
    if (/getting worse|worsening|deteriorat/i.test(text)) facts.push("Symptoms worsening")
    else if (/improving|getting better|much better/i.test(text)) facts.push("Symptoms improving")
    else if (/\bmild\b/i.test(text)) facts.push("Mild severity")
    else if (/\bsevere\b|\bvery bad\b/i.test(text)) facts.push("Severe symptoms")
  }

  return facts.slice(0, 3)
}
