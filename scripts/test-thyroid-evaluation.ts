import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { EvaluationEngine } from '../engine/evaluation/EvaluationEngine';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function runThyroidTest() {
    console.log("Reading thyroid case JSON...");
    const filePath = path.join(__dirname, '../data/cases/non-toxic-nodular-goitre-neck-swelling.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const caseData = JSON.parse(rawData);

    const diagnosis = {
        primaryDiagnosis: "non-toxic nodular goitre",
        managementPlan: "Refer to surgical OPD for thyroidectomy due to compressive symptoms (dysphagia, hoarseness, and exertional dyspnea)."
    };

    const orderedTests = [
        { id: "thyroid-function-tests", name: "Thyroid Function Tests (TFT)" },
        { id: "thyroid-ultrasound", name: "Ultrasonography of Neck/Thyroid (USG)" },
        { id: "fine-needle-aspiration-cytology", name: "Fine-Needle Aspiration Cytology (FNAC)" }
    ];

    const chatHistory = [
        { role: "user", content: "How long have you had this neck swelling?" },
        { role: "assistant", content: "About 15 days." },
        { role: "user", content: "Is the neck swelling painful?" },
        { role: "assistant", content: "No, it is painless." },
        { role: "user", content: "Have you noticed any difficulty swallowing?" },
        { role: "assistant", content: "Yes, I have difficulty swallowing." },
        { role: "user", content: "Has your voice changed recently?" },
        { role: "assistant", content: "Yes, my voice has changed." },
        { role: "user", content: "Do you have any difficulty breathing?" },
        { role: "assistant", content: "Yes, I have difficulty breathing when I exert myself." }
    ];

    console.log("Running EvaluationEngine.evaluate on thyroid case...");
    try {
        const result = await EvaluationEngine.evaluate(
            diagnosis,
            orderedTests,
            chatHistory,
            caseData
        );
        console.log("\n═══════════════════════════════════════════════════");
        console.log("THYROID CASE EVALUATION COMPLETED SUCCESSFULLY!");
        console.log("═══════════════════════════════════════════════════");
        console.log("Final Score:", result.score);
        console.log("History Score:", result.historyScore);
        console.log("Reasoning Score:", result.reasoningScore);
        console.log("Diagnosis Score:", result.diagnosisScore);
        console.log("Testing Score:", result.testingScore);
        console.log("Management Score:", result.managementScore);
        console.log("Is Correct:", result.isCorrect);
        console.log("Strengths:", result.feedback.strengths);
        console.log("Improvements:", result.feedback.improvements);
        console.log("═══════════════════════════════════════════════════\n");
    } catch (error: any) {
        console.error("Evaluation Failed with Error:", error);
    }
}

runThyroidTest();
