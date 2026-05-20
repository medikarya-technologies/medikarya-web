import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getCaseModule } from "@/cases/registry"

export async function POST(request: NextRequest) {
  try {
    // Allow both authenticated and guest users
    try {
      await auth()
    } catch {
      // Guest access — no session
    }

    const body = await request.json()
    const { test, caseData, chatHistory } = body

    // 1. Try to get logic from case module
    const caseId = caseData.id || caseData.patient?.id || "unknown"
    const caseModule = getCaseModule(caseId)

    let results = null

    if (caseModule) {
      const investigationLogic = caseModule.getInvestigationLogic(caseData)

      // Match by test.id — stable, exact, no substring tricks
      const testId: string = test.id

      if (!testId) {
        console.warn("[generate-result] test.id is missing — cannot look up rule:", test)
      }

      const rule = testId ? investigationLogic[testId] : undefined

      if (rule !== undefined) {
        if (typeof rule === "function") {
          try {
            results = rule(test, { caseData, chatHistory: chatHistory || [] })
          } catch (e) {
            console.error("[generate-result] Rule function execution failed:", e)
          }
        } else {
          results = rule
        }
      } else {
        console.log(`[generate-result] No module rule for test.id="${testId}" — falling through to mock`)
      }
    }

    // 2. Fallback to mock generator if no specific case logic found
    if (!results) {
      results = generateMockTestResults(test, caseData)
    }

    return NextResponse.json({
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("Error generating test results:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Mock test result generator (will be replaced with AI API)
function generateMockTestResults(test: any, caseData: any) {
  const testId = test.id

  // Generate results based on test type
  switch (testId) {
    case "troponin":
      return {
        summary: "Troponin I - Elevated",
        values: [
          {
            parameter: "Troponin I",
            value: "2.8",
            unit: "ng/mL",
            normalRange: "< 0.04",
            status: "high"
          }
        ],
        interpretation: "Significantly elevated troponin levels indicate myocardial injury. This finding is consistent with acute myocardial infarction.",
        criticalFindings: ["Elevated troponin I (2.8 ng/mL) - Immediate cardiology consultation recommended"]
      }

    case "ecg":
      return {
        summary: "12-Lead ECG - Abnormal",
        values: [],
        interpretation: "ST-segment elevation in leads II, III, and aVF. Consistent with inferior wall myocardial infarction. Reciprocal ST depression in leads I and aVL.",
        criticalFindings: ["ST-segment elevation - STEMI protocol activated"]
      }

    case "cbc":
      return {
        summary: "Complete Blood Count - Within Normal Limits",
        values: [
          { parameter: "WBC", value: "8.5", unit: "×10³/μL", normalRange: "4.5-11.0", status: "normal" },
          { parameter: "RBC", value: "4.8", unit: "×10⁶/μL", normalRange: "4.5-5.5", status: "normal" },
          { parameter: "Hemoglobin", value: "14.2", unit: "g/dL", normalRange: "13.5-17.5", status: "normal" },
          { parameter: "Platelets", value: "245", unit: "×10³/μL", normalRange: "150-400", status: "normal" }
        ],
        interpretation: "All blood cell counts are within normal limits.",
        criticalFindings: []
      }

    case "bmp":
      return {
        summary: "Basic Metabolic Panel - Normal",
        values: [
          { parameter: "Sodium", value: "140", unit: "mEq/L", normalRange: "136-145", status: "normal" },
          { parameter: "Potassium", value: "4.2", unit: "mEq/L", normalRange: "3.5-5.0", status: "normal" },
          { parameter: "Glucose", value: "105", unit: "mg/dL", normalRange: "70-100", status: "slightly high" },
          { parameter: "Creatinine", value: "1.0", unit: "mg/dL", normalRange: "0.7-1.3", status: "normal" }
        ],
        interpretation: "Electrolytes and kidney function are within normal limits. Glucose slightly elevated, likely stress-related.",
        criticalFindings: []
      }

    case "chest-xray":
      return {
        summary: "Chest X-Ray - Cardiomegaly",
        values: [],
        interpretation: "Mild cardiomegaly noted. No acute pulmonary infiltrates or effusions. Costophrenic angles are sharp. No pneumothorax.",
        criticalFindings: []
      }

    case "lipid":
      return {
        summary: "Lipid Panel - Elevated LDL",
        values: [
          { parameter: "Total Cholesterol", value: "245", unit: "mg/dL", normalRange: "< 200", status: "high" },
          { parameter: "LDL", value: "165", unit: "mg/dL", normalRange: "< 100", status: "high" },
          { parameter: "HDL", value: "38", unit: "mg/dL", normalRange: "> 40", status: "low" },
          { parameter: "Triglycerides", value: "210", unit: "mg/dL", normalRange: "< 150", status: "high" }
        ],
        interpretation: "Dyslipidemia with elevated LDL and triglycerides, low HDL. Significant cardiovascular risk factor.",
        criticalFindings: []
      }

    default:
      return {
        summary: `${test.name} - Completed`,
        values: [],
        interpretation: "Test completed successfully. Results are being analyzed.",
        criticalFindings: []
      }
  }
}
