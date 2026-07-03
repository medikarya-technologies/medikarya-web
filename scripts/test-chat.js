const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const { Groq } = require("groq-sdk");

const dummyCase = {
    id: "migraine-case",
    patient: { name: "Alex" },
    patient_text_brief: "You are Alex, a 20-year-old college student experiencing severe, throbbing left-sided headaches for 3 months, worse this time. You feel nauseous and sensitive to light.",
    patient_facts: {
        "Onset": "3 months ago, but this episode started 2 days ago and is much worse",
        "Location": "Left-sided throbbing pain",
        "Associated symptoms": "Nausea, flashes of light before pain, light sensitivity"
    },
    ai_role: {
        speaker: "patient",
        first_person_description: "Alex, an anxious college student"
    },
    ai_examples: [
        { doctor: "Hello, what brings you here?", patient: "Doctor, my head has been pounding since yesterday and I can't stand the light." }
    ]
};

async function testChat() {
    const apiKey = process.env.GROQ_API_KEY;
    const groq = new Groq({ apiKey });

    // Let's build patient memory
    const facts = Object.entries(dummyCase.patient_facts || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");

    const examples = (dummyCase.ai_examples || [])
        .map(ex => `"${ex.patient}"`)
        .join("\n");

    const role = `You are speaking as: Alex, an anxious college student`;

    const compiledMemory = `
${role}

PATIENT NARRATIVE:
${dummyCase.patient_text_brief}

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
- Do not use bullet points.
- Act like a worried parent/patient, not a medical case report.
- DO NOT invent, assume, or make up any facts, symptoms, or medical details not explicitly provided in the PATIENT CONTEXT. If asked about something not mentioned in the context, say you don't know, don't remember, or haven't checked.

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
            model: "qwen/qwen3-32b",
            temperature: 0.4,
            max_completion_tokens: 1024, // Let's increase this!
            reasoning_format: "hidden", // Hide reasoning so we only get the clean output!
            stream: false
        });

        console.log("\nRAW LLM Output with hidden reasoning:");
        console.log(JSON.stringify(chatCompletion.choices[0]?.message?.content));
    } catch (e) {
        console.error("Failed with reasoning_format: hidden", e.message);
    }
}

testChat();
