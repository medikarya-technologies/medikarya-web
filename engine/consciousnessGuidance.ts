// How the patient's CURRENT consciousness (in a live case it changes as the encounter goes on) should change the way
// the speaker talks. The patient speaking for themselves gets slower and vaguer. Someone speaking FOR the patient
// does not: a drowsy patient does not make his wife or the nurse drowsy, they get more urgent. Without this a live
// case whose patient becomes unresponsive would stop the history mid-way, because the person giving it would be told
// they cannot speak.

export type SpeakerKind = "self" | "parent" | "companion";

const PARENT = /\b(mother|father|parent|guardian)\b/;
const COMPANION = /\b(wife|husband|spouse|partner|son|daughter|brother|sister|friend|neighbou?r|relative|carer|caregiver|nurse|attendant|colleague)\b/;

/** Who is talking: the patient, a parent of a child, or someone else speaking for the patient. */
export function speakerKind(aiRole: { speaker?: unknown; can_speak_for_self?: unknown } | null | undefined): SpeakerKind {
  const speaker = typeof aiRole?.speaker === "string" ? aiRole.speaker.toLowerCase() : "";
  if (PARENT.test(speaker)) return "parent";
  if (COMPANION.test(speaker) || aiRole?.can_speak_for_self === false) return "companion";
  return "self";
}

/** The prompt line for this consciousness level and speaker, or "" when it changes nothing. */
export function consciousnessGuidance(level: string | undefined, kind: SpeakerKind): string {
  if (!level) return "";
  if (kind === "parent") {
    switch (level) {
      case "drowsy":
      case "altered":
        return "Your child is very sleepy and hard to rouse right now. You are frightened and urgent — speak quickly, in short anxious sentences, and press the doctor for reassurance and action.";
      case "unresponsive":
        return "Your child is not responding to you at all right now. You are panicking — short, urgent, pleading sentences.";
      default:
        return "";
    }
  }
  if (kind === "companion") {
    switch (level) {
      case "drowsy":
      case "altered":
        return "The patient is very sleepy and hard to rouse right now. You are worried and urgent: still answer the doctor's questions clearly, in short anxious sentences, and press for help.";
      case "unresponsive":
        return "The patient is not responding to anyone right now. You are frightened: short, urgent sentences, but you still answer the doctor's questions with what you know.";
      default:
        return "";
    }
  }
  switch (level) {
    case "drowsy":
      return "You are drowsy and fading. Answer in short, slow, half-finished sentences (3-6 words). You may need a question repeated before you respond.";
    case "altered":
      return "Your thinking is confused. Answers may be brief, slightly off-topic, or trail off. You may not fully track what was asked.";
    case "unresponsive":
      return "You cannot speak right now. You may only groan or make a wordless sound — do not form real words or answer the question.";
    case "anxious":
      return "You are alert but frightened — answer normally, but let the fear show.";
    default:
      return "";
  }
}
