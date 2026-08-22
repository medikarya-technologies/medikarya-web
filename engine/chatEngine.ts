import { CaseData } from '../data/cases/index';
import { CaseResponse } from '../cases/types';
import { Groq } from "groq-sdk";

export class ChatEngine {

    private static sessionHistories: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map();
    private static readonly MAX_HISTORY_MESSAGES = 12; // ~6 exchanges

    static async processRequest(
        message: string,
        caseData: CaseData,
        userId: string
    ): Promise<CaseResponse | { error: string, status: number }> {

        if (!message || (!caseData?.patient_text_brief && !caseData?.patient_facts)) {
            return { error: "Missing message or patient data", status: 400 };
        }

        return await this.generateLLMResponse(message, caseData, userId);
    }

    static async generateOpening(caseData: CaseData): Promise<string> {
        const compiledMemory = this.buildPatientMemory(caseData);
        const isGuardian =
            caseData.ai_role?.speaker?.toLowerCase().includes("mother") ||
            caseData.ai_role?.speaker?.toLowerCase().includes("father") ||
            caseData.ai_role?.speaker?.toLowerCase().includes("guardian");

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
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) return isGuardian
                ? `Doctor, please help — something is wrong with my ${caseData.patient.name}.`
                : "Doctor, I'm not feeling well at all.";

            const groq = new Groq({ apiKey });
            const result = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "qwen/qwen3.6-27b",
                temperature: 0.7,
                max_completion_tokens: 4096,
                reasoning_format: "hidden",
                reasoning_effort: "none",
                stream: false
            } as any);

            let line = result.choices[0]?.message?.content?.trim() || "";
            // Strip thinking/reasoning tags if present
            line = line.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
            line = line.replace(/<think>[\s\S]*/gi, "").trim();
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
    private static buildPatientMemory(caseData: CaseData): string {
        const facts = Object.entries(caseData.patient_facts || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n");

        const examples = (caseData.ai_examples || [])
            .map(ex => `"${ex.patient}"`)
            .join("\n");

        const role = caseData.ai_role
            ? `You are speaking as: ${caseData.ai_role.first_person_description || "the patient"}`
            : `You are speaking as: the patient`;

        return `
${role}

PATIENT NARRATIVE:
${caseData.patient_text_brief || ""}

KNOWN MEDICAL DETAILS:
${facts || "None explicitly listed."}

HOW YOU NATURALLY SPEAK:
${examples || "Simple, worried, conversational language."}
`.trim();
    }

    private static async generateLLMResponse(
        message: string,
        caseData: CaseData,
        userId: string
    ): Promise<CaseResponse | { error: string, status: number }> {

        const compiledMemory = this.buildPatientMemory(caseData);

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

PATIENT CONTEXT (Use this to answer questions, but do not recite it):
${compiledMemory}
`.trim();


        const historyKey = `${userId}:${caseData.id}`;
        let history = this.sessionHistories.get(historyKey) || [];
        history = history.filter(h => h.content?.trim());

        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: systemPrompt },
            ...history.map(msg => ({ role: msg.role, content: msg.content })),
            { role: "user", content: message }
        ];

        try {
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) {
                return { error: "Missing GROQ_API_KEY", status: 500 };
            }

            const groq = new Groq({ apiKey });

            const chatCompletion = await groq.chat.completions.create({
                messages,
                model: "qwen/qwen3.6-27b",
                temperature: 0.4,
                max_completion_tokens: 4096,
                reasoning_format: "hidden",
                reasoning_effort: "none",
                stream: false
            } as any);

            let text = chatCompletion.choices[0]?.message?.content?.trim() || "I don't know.";
            // Strip thinking/reasoning tags if present
            text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
            text = text.replace(/<think>[\s\S]*/gi, "").trim();

            // Strip prefixes and quotes
            text = text.replace(/^(patient|mother|father|guardian|me)\s*:\s*/i, "").trim();
            text = text.replace(/^["'“”‘’]|["'“”‘’]$/g, "").trim();

            text = text.split("\n")[0].trim();
            
            // Second pass in case prefix/quotes were nested
            text = text.replace(/^(patient|mother|father|guardian|me)\s*:\s*/i, "").trim();
            text = text.replace(/^["'“”‘’]|["'“”‘’]$/g, "").trim();

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
