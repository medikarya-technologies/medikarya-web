// What the AI patient says is shown as speech, and people do not talk in em dashes: the model reaches for them
// anyway (it copied one from the opening line's own example), and they read as written text, not a worried mother.
// A dash between two thoughts becomes a comma, a dash where the speaker breaks off becomes "...", and a number range
// written with an unspaced en dash ("3–4 days") is left alone.

export function spokenDashes(text: string): string {
  return text
    .replace(/\s*[—–]\s*$/, "...")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s+–\s+/g, ", ")
    .replace(/,\s*([,.?!;:])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim()
}
