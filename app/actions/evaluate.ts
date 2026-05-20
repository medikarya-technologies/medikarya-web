"use server";

import { EvaluationEngine } from "@/engine/evaluationEngine";
import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase/server";

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

        // Attempt to insert result to Supabase
        try {
            const { userId } = await auth();
            if (userId || guestId) {
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

                const insertPayload: Record<string, any> = {
                    case_id: caseId,
                    score: Math.round(result.score),
                    xp_earned: finalXpEarned,
                    time_taken: timeTaken,
                    feedback_json: persistedFeedback,
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

        return { ...result, xpEarned: finalXpEarned };
    } catch (error) {
        console.error("Evaluation Server Action Failed", error);
        throw new Error("Failed to evaluate case");
    }
}
