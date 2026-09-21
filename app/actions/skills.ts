"use server";

import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase/server";
import { buildSkillProfile, NO_SKILLS, type AttemptFeedback, type SkillProfile } from "@/lib/library/skills";

// Only the few numbers and ids the Progress page needs out of each stored attempt, by JSON path: an attempt's
// feedback also holds its whole event log and the written feedback, most of the weight of the row.
const COLUMNS = [
    "case_id",
    "created_at",
    "historyScore:feedback_json->historyScore",
    "testingScore:feedback_json->testingScore",
    "reasoningScore:feedback_json->reasoningScore",
    "diagnosisScore:feedback_json->diagnosisScore",
    "managementScore:feedback_json->managementScore",
    "missedRedFlags:feedback_json->missedRedFlags",
    "simDomains:feedback_json->simulation->domains",
    "simGaps:feedback_json->simulation->knowledgeGaps",
    "clinicalScore:feedback_json->simulation->clinicalScore",
    "independentScore:feedback_json->simulation->independentScore",
].join(", ");

/**
 * Where the signed-in student's marks go, from their last 200 attempts: an average for each part of a case, the
 * red flags and gaps they miss most often, and what hints cost them. Empty when signed out and on any error, so
 * the Progress page still opens (it just leaves the cards out).
 */
export async function getSkillProfile(): Promise<SkillProfile> {
    try {
        const { userId } = await auth();
        if (!userId) return NO_SKILLS;

        const { data, error } = await supabaseServer.from("case_attempts").select(COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
        if (error) {
            console.error("Error fetching attempts for the skill profile:", error);
            return NO_SKILLS;
        }
        return buildSkillProfile((data ?? []) as unknown as AttemptFeedback[]);
    } catch (error) {
        console.error("Failed to build the skill profile:", error);
        return NO_SKILLS;
    }
}
