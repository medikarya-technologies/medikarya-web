import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCaseById } from "@/data/cases";
import { supabaseServer } from "@/lib/supabase/server";
import { allow, clientIp } from "@/lib/rate-limit";
import { GUEST_CASE_IDS, caseKindOf, indiaDay, lockedFor } from "./limits";
import { getPlanStatus } from "./server";

// Who may read a whole case, and who may spend AI on one. The start route (app/api/cases/[id]/start) is where a
// case is opened and counted; these keep the other routes from being a way around it:
//   - GET /api/cases/[id] gives the whole case only to someone whose plan includes it (anyone, for the /try case);
//     everyone else gets the briefing only, which has no diagnosis, answers, script or results in it.
//   - The AI routes (patient chat, its opening line, the quiz) load the case from the server by id, never from the
//     request, and answer only for a case this student opened today or yesterday, within a rate limit.

export async function viewerId(): Promise<string | null> {
  try {
    return (await auth()).userId ?? null;
  } catch {
    return null;
  }
}

/** A draft (not yet published) case is only for admins, who play-test it before publishing. */
export function isDraft(caseData: object): boolean {
  const status = (caseData as { status?: unknown }).status;
  return typeof status === "string" && status !== "published";
}

export async function isAdmin(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabaseServer.from("user_profiles").select("role").eq("clerk_user_id", userId).maybeSingle();
  return data?.role === "admin";
}

/** Whether this student's plan includes this case at all (daily counts aside). */
export async function planIncludes(userId: string | null, caseId: string, caseData: { difficulty?: string; event_rules?: unknown }): Promise<boolean> {
  if (GUEST_CASE_IDS.includes(caseId)) return true;
  if (!userId) return false;
  const status = await getPlanStatus(userId);
  return status.admin || !lockedFor(status.plan, caseKindOf(caseData), status.liveEver);
}

/** The case as the pre-start briefing needs it (patient, look, vitals on arrival) and nothing that answers it. */
export function briefingOnly(caseData: Record<string, any>) {
  const { final_diagnosis: _dx, investigations: _inv, ...patient } = caseData.patient ?? {};
  return {
    id: caseData.id,
    title: caseData.displayTitle ?? "Patient case",
    displayTitle: caseData.displayTitle,
    displayDescription: caseData.displayDescription,
    category: caseData.category,
    difficulty: caseData.difficulty,
    estimatedTime: caseData.estimatedTime,
    xpReward: caseData.xpReward,
    setting: caseData.setting,
    patient,
    appearance: caseData.appearance,
    credit: caseData.credit,
    // only the public part: the reviewer's name is here at all only if they agreed to be named
    review: caseData.review?.decision === "approved" && caseData.review.show_name ? caseData.review : undefined,
    initial_state: caseData.initial_state,
    // kept as empty lists so the briefing still recognises a bedside case; `live` says what the rules would have
    event_rules: [],
    action_consequences: [],
    live: caseKindOf(caseData).live,
    briefingOnly: true,
  };
}

async function openedRecently(userId: string, caseId: string): Promise<boolean> {
  const today = indiaDay();
  const yesterday = indiaDay(new Date(Date.now() - 86_400_000));
  const { data, error } = await supabaseServer
    .from("case_starts")
    .select("id")
    .eq("clerk_user_id", userId)
    .eq("case_id", caseId)
    .in("day", [today, yesterday])
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export type AiUse = "chat" | "opening" | "quiz" | "evaluate";

// [per minute, per day] for a signed-in student, and for a signed-out visitor (by IP, the /try case only).
const LIMITS: Record<AiUse, { user: [number, number]; guest: [number, number] }> = {
  chat: { user: [30, 800], guest: [15, 150] },
  opening: { user: [10, 100], guest: [5, 30] },
  quiz: { user: [4, 40], guest: [2, 10] },
  evaluate: { user: [4, 60], guest: [2, 10] },
};

const MINUTE = 60_000;
const DAY = 86_400_000;

export type AiAccess = { ok: true; caseData: any; userId: string } | { ok: false; status: number; error: string };

/**
 * May this caller spend AI on this case now? The case comes back from the server (callers use it, never their
 * own copy). On the dev preview pages (never in production) a signed-out caller may use any case.
 */
export async function checkAiAccess(caseId: unknown, use: AiUse, ip: string): Promise<AiAccess> {
  if (typeof caseId !== "string" || !caseId) return { ok: false, status: 400, error: "Missing case id" };

  const userId = await viewerId();
  const guest = !userId;
  const who = userId ?? `ip:${ip}`;
  const [perMinute, perDay] = LIMITS[use][guest ? "guest" : "user"];
  if (!allow(`${use}:m:${who}`, perMinute, MINUTE) || !allow(`${use}:d:${who}`, perDay, DAY)) {
    return { ok: false, status: 429, error: "You're going a little fast. Please wait a moment and try again." };
  }

  const caseData = await getCaseById(caseId);
  if (!caseData) return { ok: false, status: 404, error: "Case not found" };
  // A draft is for admins to play-test, never anyone else, not even on the dev preview pages.
  if (isDraft(caseData) && !(await isAdmin(userId))) return { ok: false, status: 404, error: "Case not found" };

  const freeCase = GUEST_CASE_IDS.includes(caseId);
  const devPreview = process.env.NODE_ENV !== "production";

  if (guest) {
    return freeCase || devPreview ? { ok: true, caseData, userId: "guest" } : { ok: false, status: 401, error: "Sign in to continue this case." };
  }

  // A case is only ever started (and recorded) if the plan allowed it then, so having started it today or
  // yesterday (a case can run past midnight) is what the AI needs; admins can use any case.
  if (!freeCase) {
    try {
      if (!(await openedRecently(userId, caseId)) && !(await getPlanStatus(userId)).admin) {
        return { ok: false, status: 403, error: "Start this case first." };
      }
    } catch (error) {
      console.error("Could not check case access:", error);
      return { ok: false, status: 503, error: "We could not check your plan just now. Please try again." };
    }
  }

  return { ok: true, caseData, userId };
}

/** checkAiAccess for an API route: the case, or the response to send instead. */
export async function authorizeAiCase(
  request: Request,
  caseId: unknown,
  use: AiUse
): Promise<{ caseData: any; userId: string } | { response: NextResponse }> {
  const access = await checkAiAccess(caseId, use, clientIp(request));
  return access.ok ? { caseData: access.caseData, userId: access.userId } : { response: NextResponse.json({ error: access.error }, { status: access.status }) };
}
