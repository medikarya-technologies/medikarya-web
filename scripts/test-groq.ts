const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const { Groq } = require("groq-sdk");

async function testGroq() {
    console.log("Testing Groq API...");
    const apiKey = process.env.GROQ_API_KEY;
    console.log("API Key present:", !!apiKey);
    if (apiKey) {
        console.log("API Key prefix:", apiKey.substring(0, 4) + "...");
    }

    if (!apiKey) {
        throw new Error("Missing GROQ_API_KEY");
    }

    const groq = new Groq({ apiKey });

    try {
        console.log("Sending simple request...");
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful assistant. Reply in JSON." },
                { role: "user", content: "Say hello." }
            ],
            model: "openai/gpt-oss-120b",
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        console.log("Response received:", completion.choices[0]?.message?.content);
    } catch (error) {
        console.error("Groq Test Failed:", error);
    }
}

testGroq();
