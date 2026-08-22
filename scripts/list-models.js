const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const { Groq } = require("groq-sdk");

async function listModels() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.error("Missing GROQ_API_KEY");
        return;
    }
    const groq = new Groq({ apiKey });
    try {
        const response = await groq.models.list();
        console.log("Available Models:");
        for (const model of response.data) {
            console.log(`- ID: ${model.id}, Owned By: ${model.owned_by}`);
        }
    } catch (e) {
        console.error("Error fetching models:", e);
    }
}

listModels();
