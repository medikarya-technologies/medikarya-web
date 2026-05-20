import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

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

    // TODO: Replace with actual AI API call to generate comprehensive feedback

    // Example: Call AI to generate feedback
    /*
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert medical educator providing feedback on a student's case diagnosis.
            
            Case Information:
            - Correct Diagnosis: ${caseData.correctDiagnosis || "Acute Myocardial Infarction"}
            - Patient: ${caseData.patient.age}y ${caseData.patient.gender}
            - Chief Complaint: ${caseData.patient.chiefComplaint}
            
            Student's Performance:
            - Diagnosis: ${diagnosis.primaryDiagnosis}
            - Differential Diagnoses: ${diagnosis.differentialDiagnoses.join(", ")}
            - Tests Ordered: ${orderedTests.map(t => t.name).join(", ")}
            - Questions Asked: ${chatHistory.length}
            
            Provide comprehensive feedback including:
            1. Whether the diagnosis is correct
            2. Score (0-100)
            3. Strengths (array of strings)
            4. Areas for improvement (array of strings)
            5. Testing efficiency analysis
            6. Recommendations for future cases
            
            Return in JSON format.`
          },
          {
            role: "user",
            content: "Generate feedback for this case."
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    })

    const data = await response.json()
    const feedback = JSON.parse(data.choices[0].message.content)
    */

    // Mock feedback for now
    const feedback = generateMockFeedback(diagnosis, orderedTests, chatHistory, caseData)

    // TODO: Save feedback to database for progress tracking

    return NextResponse.json({
      feedback,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("Error generating feedback:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Mock feedback generator (will be replaced with AI API)
function generateMockFeedback(diagnosis: any, orderedTests: any[], chatHistory: any[], caseData: any) {
  const correctDiagnosis = "Acute Myocardial Infarction"
  const studentDiagnosis = diagnosis.primaryDiagnosis

  // Check if diagnosis is correct (case-insensitive partial match)
  const isCorrect = studentDiagnosis.toLowerCase().includes("myocardial infarction") ||
    studentDiagnosis.toLowerCase().includes("heart attack") ||
    studentDiagnosis.toLowerCase().includes("mi")

  // Calculate score based on various factors
  let score = 0

  // Diagnosis correctness (40 points)
  if (isCorrect) {
    score += 40
  } else if (studentDiagnosis.toLowerCase().includes("cardiac") ||
    studentDiagnosis.toLowerCase().includes("heart")) {
    score += 20
  }

  // History taking (20 points)
  const questionsAsked = chatHistory.filter(m => m.role === "user").length
  if (questionsAsked >= 8) score += 20
  else if (questionsAsked >= 5) score += 15
  else if (questionsAsked >= 3) score += 10

  // Test ordering (20 points)
  const completedTests = orderedTests.filter(t => t.status === "completed")
  if (completedTests.length > 0) score += 20

  // Clinical reasoning (10 points)
  if (diagnosis.clinicalReasoning && diagnosis.clinicalReasoning.length > 50) {
    score += 10
  } else if (diagnosis.clinicalReasoning && diagnosis.clinicalReasoning.length > 20) {
    score += 5
  }

  // Treatment plan (10 points)
  if (diagnosis.treatmentPlan && diagnosis.treatmentPlan.length > 50) {
    score += 10
  } else if (diagnosis.treatmentPlan && diagnosis.treatmentPlan.length > 20) {
    score += 5
  }

  // Generate strengths
  const strengths = []
  if (questionsAsked >= 5) {
    strengths.push("Thorough history taking with comprehensive questioning")
  }
  if (completedTests.length > 0) {
    strengths.push("Appropriately ordered diagnostic tests")
  }
  if (diagnosis.differentialDiagnoses.length >= 2) {
    strengths.push("Good differential diagnosis consideration")
  }
  if (diagnosis.clinicalReasoning && diagnosis.clinicalReasoning.length > 50) {
    strengths.push("Clear clinical reasoning and thought process")
  }

  // Generate improvements
  const improvements = []
  if (questionsAsked < 5) {
    improvements.push("More detailed history taking would strengthen your assessment")
  }
  if (!isCorrect) {
    improvements.push("Review the classic presentation of this condition")
  }
  if (orderedTests.length > 8) {
    improvements.push("Focus on high-yield tests to improve diagnostic efficiency")
  }

  // Identify missed tests
  const missedTests = []
  // Dynamic missed tests logic to be implemented based on case data


  return {
    correctDiagnosis,
    studentDiagnosis,
    isCorrect,
    score: Math.min(score, 100),
    feedback: {
      strengths: strengths.length > 0 ? strengths : [
        "You completed the case and submitted a diagnosis",
        "You engaged with the patient interview process"
      ],
      improvements: improvements.length > 0 ? improvements : [
        "Continue practicing systematic clinical evaluation",
        "Review diagnostic criteria for common conditions"
      ],
      testingEfficiency: {
        appropriateTests: completedTests.length,
        unnecessaryTests: 0,
        missedTests: missedTests.slice(0, 3)
      }
    },
    recommendations: [
      "Review the clinical presentation",
      "Correlate findings with diagnostic results"
    ]
  }
}
