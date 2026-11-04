/** A short list of high-confidence keyboard/voice-entry slips in clinical text. */
const COMMON_CLINICAL_TYPOS: Record<string, string> = {
  pane: "pain",
  pian: "pain",
  paim: "pain",
  feaver: "fever",
};

/** Canonicalise only clear, common slips; leave the student's stored/displayed text untouched. */
export function normaliseObviousClinicalTypos(text: string): string {
  return text.replace(/\b[a-z]+\b/gi, (word) => COMMON_CLINICAL_TYPOS[word.toLowerCase()] ?? word);
}
