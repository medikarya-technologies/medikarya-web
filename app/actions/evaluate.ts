"use server";

import { EvaluationEngine } from "@/engine/evaluationEngine";
import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getCaseById, getCases } from "@/data/cases";
import { computeMilestones, newlyEarned } from "@/lib/library/milestones";
import { isSimulationCase, type SimulationCaseConfig } from "@/lib/simulation/case-schema";
import { replayStudentEvents } from "@/lib/simulation/replay";
import { computeAssistance, scoreEncounter } from "@/engine/evaluation/DualScorer";
import { classicInputsFromEvents } from "@/lib/simulation/classic-inputs";
import { countBudgetedActions, type ClinicalEvent } from "@/lib/simulation/encounter-events";

interface PersistArgs {
    caseId: string;
    score: number;
    xpEarned: number;
    timeTaken: number;
    feedbackJson: Record<string, any>;
    guestId?: string;
}

/** A milestone an attempt has just earned, as the debrief shows it. */
export interface MilestoneNotice {
    id: string;
    title: string;
    detail: string;
}

type AttemptRow = { case_id: string; score: number | null; created_at: string };

/** What the student had done before this attempt, or null when it cannot be read (then no milestone is announced). */
async function attemptsBefore(userId: string): Promise<AttemptRow[] | null> {
    try {
        const { data, error } = await supabaseServer.from("case_attempts").select("case_id, score, created_at").eq("user_id", userId);
        return error ? null : ((data ?? []) as AttemptRow[]);
    } catch {
        return null;
    }
}

/** The milestones this attempt earned: those true with it that were not true without it. Never throws. */
async function milestonesEarnedBy(before: AttemptRow[], attempt: AttemptRow): Promise<MilestoneNotice[]> {
    try {
        const cases = (await getCases()).map((c) => ({ id: c.id, category: c.category }));
        const gained = newlyEarned(computeMilestones({ attempts: before, cases }), computeMilestones({ attempts: [...before, attempt], cases }));
        return gained.map(({ id, title, detail }) => ({ id, title, detail }));
    } catch {
        return [];
    }
}

/**
 * Saves the attempt and bumps the user's streak. Shared by the classic
 * evaluation and the simulation debrief; a database failure never fails the
 * evaluation the student is waiting on.
 */
async function persistAttempt({ caseId, score, xpEarned, timeTaken, feedbackJson, guestId }: PersistArgs): Promise<{ milestones: MilestoneNotice[] }> {
    let milestones: MilestoneNotice[] = [];
    // Attempt to insert result to Supabase
    try {
        const { userId } = await auth();
        if (userId || guestId) {
            const before = userId ? await attemptsBefore(userId) : null;
            const insertPayload: Record<string, any> = {
                case_id: caseId,
                score: Math.round(score),
                xp_earned: xpEarned,
                time_taken: timeTaken,
                feedback_json: feedbackJson,
                completed_at: new Date().toISOString()
            };

            if (userId) {
                insertPayload.user_id = userId;
            } else if (guestId) {
                insertPayload.guest_id = guestId;
            }

            const { error: dbError } = await supabaseServer
                .from("case_attempts")
                .insert(insertPayload);

            if (dbError) {
                console.error("Supabase insert error:", dbError);
            } else {
                console.log("Successfully saved case_attempt to Supabase for", userId ? `User: ${userId}` : `Guest: ${guestId}`, "Case:", caseId);
                if (userId && before) milestones = await milestonesEarnedBy(before, { case_id: caseId, score: Math.round(score), created_at: new Date().toISOString() });
            }

            // --- Streak Tracking Logic (only for authenticated users) ---
            if (userId) {
            try {
                // Fetch current user profile
                const { data: profile } = await supabaseServer
                    .from("user_profiles")
                    .select("*")
                    .eq("clerk_user_id", userId)
                    .single();

                const today = new Date();
                const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

                if (profile) {
                    const lastActive = profile.last_active_date ? new Date(profile.last_active_date) : null;

                    let newCurrentStreak = profile.current_streak || 0;
                    let newLongestStreak = profile.longest_streak || 0;

                    if (!lastActive) {
                        // First time ever saving a streak for existing profile
                        newCurrentStreak = 1;
                    } else {
                        // Calculate difference in days (ignoring time zones for simplicity, using UTC dates usually better but local works for streaks)
                        const lastActiveStr = lastActive.toISOString().split('T')[0];

                        if (lastActiveStr !== todayStr) {
                            // Not active yet today
                            const msPerDay = 1000 * 60 * 60 * 24;
                            // Reset parsing to midnight to strictly compare days elapsed
                            const todayMidnight = new Date(todayStr).getTime();
                            const lastActiveMidnight = new Date(lastActiveStr).getTime();
                            const daysDifference = Math.floor((todayMidnight - lastActiveMidnight) / msPerDay);

                            if (daysDifference === 1) {
                                // Active yesterday -> streak continues
                                newCurrentStreak += 1;
                            } else if (daysDifference > 1) {
                                // Missed a day -> streak resets
                                newCurrentStreak = 1;
                            }
                            // if daysDifference === 0 somehow, do nothing (handled by !== todayStr but just in case)
                        }
                    }

                    if (newCurrentStreak > newLongestStreak) {
                        newLongestStreak = newCurrentStreak;
                    }

                    // Update profile if date changed
                    if (profile.last_active_date !== todayStr) {
                        await supabaseServer
                            .from("user_profiles")
                            .update({
                                current_streak: newCurrentStreak,
                                longest_streak: newLongestStreak,
                                last_active_date: todayStr,
                                updated_at: new Date().toISOString()
                            })
                            .eq("clerk_user_id", userId);
                    }
                } else {
                    // Safety fallback: profile doesn't exist yet
                    // (normally the Clerk webhook pre-creates it on signup)
                    await supabaseServer
                        .from("user_profiles")
                        .insert({
                            clerk_user_id: userId,
                            role: "student",
                            current_streak: 1,
                            longest_streak: 1,
                            last_active_date: todayStr
                        })
                        // If the webhook already created the row, don't overwrite anything
                        .onConflict("clerk_user_id")
                        .ignore()
                }
            } catch (streakErr) {
                console.error("Failed to update user streak:", streakErr);
            }
            // --- End Streak Logic ---
            }

        } else {
            console.log("No authenticated user, skipping Supabase insert.");
        }
    } catch (dbEx) {
        console.error("Failed to save to Supabase:", dbEx);
    }
    return { milestones };
}

export async function evaluateCase(
    diagnosis: any,
    orderedTests: any[],
    chatHistory: any[],
    caseData: any,
    timeTaken: number = 0, // timeTaken in seconds
    guestId?: string
) {
    try {
        console.log("Evaluating case for:", caseData.patient.name);
        const result = await EvaluationEngine.evaluate(
            diagnosis,
            orderedTests,
            chatHistory,
            caseData
        );

        const baseXP = caseData.xpReward || 50;
        let finalXpEarned = Math.round((result.score / 100) * baseXP);

        // Determine case_id
        const caseId = caseData.id || caseData.patient.name.toLowerCase().replace(/\s+/g, '-');

        // Prepare the full feedback payload that the UI needs
        const persistedFeedback = {
            ...result,
            xpEarned: finalXpEarned,
            caseId: caseId,
            caseTitle: caseData.displayTitle || caseData.title,
            timestamp: new Date().toISOString()
        };

        const { milestones } = await persistAttempt({
            caseId,
            score: result.score,
            xpEarned: finalXpEarned,
            timeTaken,
            feedbackJson: persistedFeedback,
            guestId,
        });

        return { ...result, xpEarned: finalXpEarned, milestones };
    } catch (error) {
        console.error("Evaluation Server Action Failed", error);
        throw new Error("Failed to evaluate case");
    }
}

/**
 * A classic case run at the bedside. The Clinical score is the classic evaluator's, from the
 * case's own `evaluation_config`; the Independent score is that minus what the student spent
 * on assists. The event log is replayed first, so assist prices and the record of what the
 * student did are the server's, not the client's.
 */
async function evaluateClassicEncounter(
    config: SimulationCaseConfig & Record<string, any>,
    events: unknown,
    timeTaken: number,
    guestId?: string
) {
    const replayed = replayStudentEvents(config, events);
    const log: readonly ClinicalEvent[] = replayed.events;
    const inputs = classicInputsFromEvents(log);
    const result = await EvaluationEngine.evaluate(inputs.diagnosis, inputs.orderedTests, inputs.chatHistory, config);

    const assistance = computeAssistance(log);
    const clinicalScore = Math.round(result.score);
    const independentScore = Math.min(100, Math.max(0, clinicalScore - assistance.total));

    const firstOrderedAt: Record<string, number> = {};
    for (const e of log) if (e.type === "TEST_ORDERED" && !(e.testId in firstOrderedAt)) firstOrderedAt[e.testId] = e.timestamp;

    const simulation = {
        version: 2,
        scoring: "classic" as const,
        clinicalScore,
        independentScore,
        assistanceCost: assistance.total,
        assistance: assistance.lines,
        milestones: {
            firstOrderedAt,
            budgetedActions: countBudgetedActions(log),
            endedAt: log.length > 0 ? log[log.length - 1].timestamp : 0,
        },
        events: log,
        timeTaken,
    };

    const xpEarned = Math.round((result.score / 100) * (config.xpReward || 50));
    const caseId = config.id;

    const { milestones } = await persistAttempt({
        caseId,
        score: result.score,
        xpEarned,
        timeTaken,
        feedbackJson: {
            ...result,
            xpEarned,
            caseId,
            caseTitle: config.displayTitle || config.title,
            timestamp: new Date().toISOString(),
            simulation,
        },
        guestId,
    });

    return { ...result, xpEarned, simulation, milestones };
}

/**
 * Scores a simulation encounter: Clinical + Independent, from one event log.
 *
 * The client sends its event log, but the server does not take its word for the
 * parts it can work out itself. It scores against ITS copy of the case (rubric,
 * rules and assist prices), replays only what the student actually did, and
 * regenerates every deterioration and consequence from the case's rules. See
 * lib/simulation/replay.ts.
 */
export async function evaluateSimulation(
    events: unknown,
    caseData: any,
    timeTaken: number = 0,
    guestId?: string
) {
    try {
        const caseId: string | undefined = caseData?.id;
        const authoritative = caseId ? await getCaseById(caseId) : null;
        if (!authoritative || !isSimulationCase(authoritative)) {
            throw new Error(`Simulation case "${caseId}" not found`);
        }
        const config = authoritative as SimulationCaseConfig & Record<string, any>;
        if (config.scoring_mode === "classic") return await evaluateClassicEncounter(config, events, timeTaken, guestId);
        const rubric = config.scoring_rubric;
        if (!rubric) throw new Error(`Case "${caseId}" has no scoring rubric`);

        const replayed = replayStudentEvents(config, events);
        const scored = scoreEncounter(replayed.events, config);

        const baseXP = (config as any).xpReward || 50;
        const xpEarned = Math.round((scored.clinicalScore / 100) * baseXP);

        const investigation = scored.items.filter((i) => i.domain === "investigation_accuracy");
        const result = {
            // Top-level fields the rest of the app already understands. The headline score is Clinical;
            // the Independent score rides along in `simulation`.
            score: scored.clinicalScore,
            finalScore: scored.clinicalScore,
            isCorrect: scored.diagnosis.isCorrect,
            studentDiagnosis: scored.diagnosis.studentDiagnosis,
            correctDiagnosis: scored.diagnosis.groundTruth,
            testingScore: Math.round((scored.domains.investigation_accuracy / 100) * 20),
            reasoningScore: Math.round((scored.domains.clinical_reasoning / 100) * 30),
            historyScore: 0,
            diagnosisScore: scored.diagnosis.isCorrect ? 15 : 0,
            managementScore: Math.round((scored.domains.management / 100) * 10),
            safetyPenalty:
                scored.safetyIssues.length * (rubric.safety_penalty_points ?? 15) +
                scored.penalties.reduce((s, p) => s + p.points, 0),
            missedRedFlags: [] as string[],
            redFlagResolutions: [] as unknown[],
            feedback: {
                strengths: scored.didWell,
                improvements: scored.missed.map((m) => m.text),
                testingEfficiency: {
                    appropriateTests: investigation.filter((i) => i.credit >= 0.5).length,
                    unnecessaryTests: scored.penalties.filter((p) => p.domain === "investigation_accuracy").length,
                    missedTests: investigation.filter((i) => i.credit < 0.5 && i.critical).map((i) => i.label),
                },
            },
            simulation: {
                version: 1,
                ...scored,
                events: replayed.events,
                timeTaken,
            },
        };

        const { milestones } = await persistAttempt({
            caseId: caseId as string,
            score: result.score,
            xpEarned,
            timeTaken,
            feedbackJson: {
                ...result,
                xpEarned,
                caseId,
                caseTitle: (config as any).displayTitle || (config as any).title,
                timestamp: new Date().toISOString(),
            },
            guestId,
        });

        return { ...result, xpEarned, milestones };
    } catch (error) {
        console.error("Simulation evaluation failed", error);
        throw new Error("Failed to evaluate simulation");
    }
}
