// Sample student data for the dev preview pages (/sim-preview/dashboard, /library, /profile and /progress), so the
// dashboard can be seen without signing in. The cases are real (from the database); the attempts are made up,
// and go through the same code (buildDashboardStats) that turns the real attempts table into the numbers.

import { computeMilestones, type Milestone } from "@/lib/library/milestones"
import { buildSkillProfile, NO_SKILLS, type AttemptFeedback, type SkillProfile } from "@/lib/library/skills"
import { buildDashboardStats, NO_STATS, type AttemptRecord, type CaseProgress, type DashboardStats, type LibraryCase, type ProgressMap } from "@/lib/library/case-library"

const DAY = 86_400_000

/** A few attempts across the first cases: scores from weak to strong, some tried more than once. */
export function sampleProgress(cases: LibraryCase[], empty: boolean): ProgressMap {
  if (empty) return {}
  const plan: Array<[number, number, number, number]> = [
    // [index in the list, best score, attempts, days since the latest attempt]
    [0, 88, 2, 0],
    [2, 55, 3, 3],
    [3, 96, 1, 9],
    [5, 72, 1, 20],
  ]
  const out: Record<string, CaseProgress> = {}
  for (const [i, best, attempts, ago] of plan) {
    const c = cases[i]
    if (c) out[c.id] = { attempts, best, last: new Date(Date.now() - ago * DAY).toISOString() }
  }
  return out
}

export function sampleAttempts(cases: LibraryCase[], progress: ProgressMap): AttemptRecord[] {
  const rows: AttemptRecord[] = []
  let id = 1
  for (const c of cases) {
    const p = progress[c.id]
    if (!p) continue
    // the latest attempt is the best; each earlier one was two days before it and a little weaker
    for (let k = 0; k < p.attempts; k++) {
      const score = k === 0 ? p.best : Math.max(4, p.best - 14 * k)
      rows.push({
        id: id++,
        case_id: c.id,
        score,
        xp_earned: Math.round((score / 100) * (c.xpReward || 50)),
        time_taken: 540 + ((id * 97) % 600),
        created_at: new Date(Date.parse(p.last) - k * 2 * DAY).toISOString(),
      })
    }
  }
  return rows
}

export function sampleStats(cases: LibraryCase[], progress: ProgressMap): DashboardStats {
  const rows = sampleAttempts(cases, progress)
  if (rows.length === 0) return NO_STATS
  return buildDashboardStats(rows, (caseId) => cases.find((c) => c.id === caseId)?.title, 4)
}

/** The milestones those attempts would have earned, through the same code the real Progress page uses. */
export function sampleMilestones(cases: LibraryCase[], progress: ProgressMap): Milestone[] {
  return computeMilestones({ attempts: sampleAttempts(cases, progress), cases: cases.map((c) => ({ id: c.id, category: c.category })) })
}

/** What "where you lose marks" reads from stored attempts: some classic-scored, one rubric-scored. */
export function sampleSkills(empty: boolean): SkillProfile {
  if (empty) return NO_SKILLS
  const at = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString()
  const rows: AttemptFeedback[] = [
    { case_id: "malaria-returning-traveller-fever", created_at: at(0), historyScore: 15, testingScore: 17, reasoningScore: 16, diagnosisScore: 15, managementScore: 3, missedRedFlags: ["thrombocytopenia", "haemolytic_anaemia"], clinicalScore: 62, independentScore: 55 },
    { case_id: "complete-heart-block-syncope", created_at: at(3), historyScore: 9, testingScore: 12, reasoningScore: 12, diagnosisScore: 15, managementScore: 2, missedRedFlags: ["severe_bradycardia", "exertional_syncope"], clinicalScore: 51, independentScore: 51 },
    { case_id: "complete-heart-block-syncope", created_at: at(4), historyScore: 7, testingScore: 10, reasoningScore: 9, diagnosisScore: 0, managementScore: 0, missedRedFlags: ["severe_bradycardia"], clinicalScore: 26, independentScore: 24 },
    { case_id: "vitamin-b12-deficiency-pernicious-anaemia", created_at: at(9), historyScore: 12, testingScore: 14, reasoningScore: 14, diagnosisScore: 15, managementScore: 4, missedRedFlags: ["neurological_involvement"] },
    { case_id: "acute-anterior-stemi", created_at: at(20), simDomains: { clinical_reasoning: 38, investigation_accuracy: 64, management: 20, efficiency: 72 }, simGaps: ["stemi_ecg_recognition", "antiplatelet_vs_reperfusion"], clinicalScore: 44, independentScore: 38 },
  ]
  return buildSkillProfile(rows)
}
