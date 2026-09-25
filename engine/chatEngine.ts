import { CaseData } from '../data/cases/index';
import { CaseResponse } from '../cases/types';
import { GoogleGenerativeAI } from "@google/generative-ai";

/** How the patient looks/behaves right now — the live simulation's own state, not the case's static authoring. */
export interface CurrentCondition {
    /** One-line description of how the patient looks/behaves right now (the same text driving the portrait/exam findings). */
    observation?: string
    /** alert | anxious | drowsy | altered | unresponsive */
    consciousness?: string
}

export class ChatEngine {

    private static sessionHistories: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map();
    private static readonly MAX_HISTORY_MESSAGES = 12; // ~6 exchanges

    private static isGuardianRole(caseData: CaseData): boolean {
        const speaker = caseData.ai_role?.speaker?.toLowerCase() || "";
        return speaker.includes("mother") || speaker.includes("father") || speaker.includes("guardian");
    }

    /**
     * How the CURRENT consciousness level should change the way the speaker talks — separate guidance for the
     * patient speaking for themselves vs. a guardian speaking about them, since a drowsy child does not mean a
     * drowsy parent: the parent gets more urgent, not less coherent.
     */
    private static consciousnessGuidance(level: string | undefined, isGuardian: boolean): string {
        if (!level) return "";
        if (isGuardian) {
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

    static async processRequest(
        message: string,
        caseData: CaseData,
        userId: string,
        currentCondition?: CurrentCondition
    ): Promise<CaseResponse | { error: string, status: number }> {

        if (!message || (!caseData?.patient_text_brief && !caseData?.patient_facts)) {
            return { error: "Missing message or patient data", status: 400 };
        }

        return await this.generateLLMResponse(message, caseData, userId, currentCondition);
    }

    static async generateOpening(caseData: CaseData, currentCondition?: CurrentCondition): Promise<string> {
        const compiledMemory = this.buildPatientMemory(caseData, currentCondition);
        const isGuardian = this.isGuardianRole(caseData);

        const prompt = `
You are roleplaying as a patient (or guardian) who has just walked into a doctor's consultation room.

${compiledMemory}

Write ONE short, emotional, natural sentence that you would say first thing — as if you just sat down across from the doctor.
- Sound worried, scared, or distressed — like a real person, not a medical report.
- Do NOT introduce yourself by name.
- Do NOT list all your symptoms. Just express the most dominant feeling or complaint naturally.
- Example style: "Doctor, please help — my chest hasn't stopped hurting since last night."
- Example style: "I'm really scared, doctor. My little boy has been vomiting all day and he can't keep anything down."
- Keep it to ONE sentence only.
`.trim();

        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) return isGuardian
                ? `Doctor, please help — something is wrong with my ${caseData.patient.name}.`
                : "Doctor, I'm not feeling well at all.";

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
            const result = await model.generateContent(prompt);
            let line = result.response.text().trim();

            // Strip any roleplay prefix like "Patient:" or quotes
            line = line.replace(/^(patient|mother|father|guardian|me)\s*:\s*/i, "").trim();
            line = line.replace(/^["']|["']$/g, "").trim();
            return line || (isGuardian ? "Doctor, please help my child." : "Doctor, I'm not feeling well.");
        } catch {
            return isGuardian
                ? `Doctor, something's wrong with my ${caseData.patient.name}.`
                : "Doctor, I really need your help.";
        }
    }


    // 🔥 THE BIG FIX — convert entire case into patient memory
    private static buildPatientMemory(caseData: CaseData, currentCondition?: CurrentCondition): string {
        const facts = Object.entries(caseData.patient_facts || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n");

        const examples = (caseData.ai_examples || [])
            .map(ex => `"${ex.patient}"`)
            .join("\n");

        const role = caseData.ai_role
            ? `You are speaking as: ${caseData.ai_role.first_person_description || "the patient"}`
            : `You are speaking as: the patient`;

        const guidance = this.consciousnessGuidance(currentCondition?.consciousness, this.isGuardianRole(caseData));
        const conditionLines = [currentCondition?.observation, guidance].filter(Boolean).join("\n");
        const conditionNow = conditionLines
            ? `\n\nRIGHT NOW, IN THIS ROOM (this can change as the encounter goes on — speak from THIS, not just the narrative above, if the two differ):\n${conditionLines}`
            : "";

        return `
${role}

PATIENT NARRATIVE:
${caseData.patient_text_brief || ""}

KNOWN MEDICAL DETAILS:
${facts || "None explicitly listed."}

HOW YOU NATURALLY SPEAK:
${examples || "Simple, worried, conversational language."}${conditionNow}
`.trim();
    }

    private static async generateLLMResponse(
        message: string,
        caseData: CaseData,
        userId: string,
        currentCondition?: CurrentCondition
    ): Promise<CaseResponse | { error: string, status: number }> {

        const compiledMemory = this.buildPatientMemory(caseData, currentCondition);

        const systemPrompt = `
You are roleplaying as a patient in a medical consultation.

CRITICAL INSTRUCTIONS:
- You are chatting with a doctor. Be conversational.
- ONLY answer what is asked. NEVER provide a summary of your whole condition unless explicitly asked "Tell me everything".
- If asked "What happened?", mention only the MOST important symptom (e.g. "He's vomiting"), do not list everything (diarrhea, fever, etc) unless asked specifically about them.
- Keep answers VERY SHORT (1 sentence).
- Act like a worried parent/patient, not a medical case report.
- CLINICAL SAFETY: Do NOT invent, assume, or make up any medical symptoms, clinical facts, lab results, or history not explicitly provided in the PATIENT CONTEXT. If asked about a symptom not mentioned, deny having it naturally (e.g., "No, I haven't had any fever").
- SOCIAL ROLEPLAY: For non-medical, personal, or conversational questions (e.g., hobbies, daily routine, school allowance), you are encouraged to improvise realistic, natural details in character to keep the conversation realistic.
- LIVE CONDITION: if PATIENT CONTEXT has a "RIGHT NOW, IN THIS ROOM" section, that is how you are THIS INSTANT — it overrides the general tone/energy implied by the narrative and past examples. A patient who is now drowsy or confused must sound drowsy or confused even if the earlier example lines sound alert.

PATIENT CONTEXT (Use this to answer questions, but do not recite it):
${compiledMemory}
`.trim();


        const historyKey = `${userId}:${caseData.id}`;
        let history = this.sessionHistories.get(historyKey) || [];
        history = history.filter(h => h.content?.trim());

        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                return { error: "Missing GEMINI_API_KEY", status: 500 };
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-3.1-flash-lite",
                systemInstruction: systemPrompt,
            });

            // Build Gemini chat history from session history
            const chatHistory = history.map(msg => ({
                role: msg.role === "assistant" ? "model" : "user" as "user" | "model",
                parts: [{ text: msg.content }],
            }));

            const chat = model.startChat({
                history: chatHistory,
                generationConfig: { temperature: 0.4, maxOutputTokens: 256 },
            });

            const result = await chat.sendMessage(message);
            let text = result.response.text().trim() || "I don't know.";

            // Strip prefixes and quotes
            text = text.replace(/^(patient|mother|father|guardian|me)\s*:\s*/i, "").trim();
            text = text.replace(/^["'""'']|["'""'']$/g, "").trim();
            text = text.split("\n")[0].trim();

            // Second pass in case prefix/quotes were nested
            text = text.replace(/^(patient|mother|father|guardian|me)\s*:\s*/i, "").trim();
            text = text.replace(/^["'""'']|["'""'']$/g, "").trim();

            const finalResponse = text || "I don't know.";

            // Save history
            history.push({ role: "user", content: message });
            history.push({ role: "assistant", content: finalResponse });

            if (history.length > this.MAX_HISTORY_MESSAGES) {
                history = history.slice(-this.MAX_HISTORY_MESSAGES);
            }

            this.sessionHistories.set(historyKey, history);

            return {
                response: finalResponse,
                timestamp: new Date().toISOString(),
                source: "ai"
            };

        } catch (error) {
            return { error: "Internal server error", status: 500 };
        }
    }
}
