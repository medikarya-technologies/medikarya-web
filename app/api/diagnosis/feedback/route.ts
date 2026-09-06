import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(request: NextRequest) {
  try {
    // Allow both authenticated and guest users
    try {
      await auth()
    } catch {
      // Guest access — no session
    }

    const body = await request.json()
    const { diagnosis, orderedTests, chatHistory, caseData } = body

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: "gemini-3.8-flash",
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    })

    const correctDiagnosis =
      caseData?.evaluation_config?.diagnosis?.accepted_primary?.[0] ??
      caseData?.patient?.final_diagnosis ??
      "Not specified"

    const prompt = `You are an expert medical educator evaluating a student's clinical case performance.

CASE INFORMATION:
- Correct Diagnosis: ${correctDiagnosis}
- Patient: ${caseData?.patient?.age ?? "Unknown"}y ${caseData?.patient?.gender ?? ""}
- Chief Complaint: ${caseData?.patient?.chiefComplaint ?? "Not specified"}

STUDENT PERFORMANCE:
- Student's Diagnosis: ${diagnosis?.primaryDiagnosis ?? "Not provided"}
- Differential Diagnoses: ${Array.isArray(diagnosis?.differentialDiagnoses) ? diagnosis.differentialDiagnoses.join(", ") : "None"}
- Tests Ordered: ${Array.isArray(orderedTests) ? orderedTests.map((t: any) => t.name).join(", ") : "None"}
- Total Questions Asked: ${Array.isArray(chatHistory) ? chatHistory.filter((m: any) => m.role === "user").length : 0}
- Clinical Reasoning: ${diagnosis?.clinicalReasoning ?? "Not provided"}
- Management Plan: ${Array.isArray(diagnosis?.managementPlan) ? diagnosis.managementPlan.join(", ") : diagnosis?.managementPlan ?? "Not provided"}

Return a JSON object with exactly these keys:
{
  "isCorrect": boolean,
  "score": number (0-100),
  "feedback": {
    "strengths": string[],
    "improvements": string[],
    "testingEfficiency": {
      "appropriateTests": number,
      "unnecessaryTests": number,
      "missedTests": string[]
    }
  },
  "recommendations": string[]
}`

    const result = await model.generateContent(prompt)
    const content = result.response.text()
    const feedback = JSON.parse(content)

    return NextResponse.json({
      feedback: {
        correctDiagnosis,
        studentDiagnosis: diagnosis?.primaryDiagnosis ?? "Not provided",
        ...feedback,
      },
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error("Error generating diagnosis feedback:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

