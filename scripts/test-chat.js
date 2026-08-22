const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const { Groq } = require("groq-sdk");
const fs = require('fs');
const path = require('path');

async function testChat() {
    const apiKey = process.env.GROQ_API_KEY;
    const groq = new Groq({ apiKey });

    const filePath = path.join(__dirname, '../data/cases/non-toxic-nodular-goitre-neck-swelling.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const caseData = JSON.parse(rawData);

    const facts = Object.entries(caseData.patient_facts || {})
        .map(([k, v]) => {
            if (typeof v === 'object' && v !== null) {
                return `${k}:\n${JSON.stringify(v, null, 2)}`;
            }
            return `${k}: ${v}`;
        })
        .join("\n");

    const examples = (caseData.ai_examples || [])
        .map(ex => `"${ex.patient}"`)
        .join("\n");

    const role = `You are speaking as: ${caseData.ai_role.first_person_description}`;

    const compiledMemory = `
${role}

PATIENT NARRATIVE:
${caseData.patient_text_brief}

KNOWN MEDICAL DETAILS:
${facts}

HOW YOU NATURALLY SPEAK:
${examples}
`.trim();

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

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "assistant", content: "Doctor, I'm not feeling well." },
        { role: "user", content: "what happened?" }
    ];

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages,
            model: "qwen/qwen3.6-27b",
            temperature: 0.4,
            max_completion_tokens: 4096,
            reasoning_format: "hidden", // Hide reasoning
            reasoning_effort: "none", // Set reasoning effort to none!
            stream: false
        });

        console.log("\nRAW LLM Output with reasoning_effort: low:");
        console.log(JSON.stringify(chatCompletion.choices[0]?.message?.content));
    } catch (e) {
        console.error("Failed", e.message);
    }
}

testChat();
