import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/plans/access";
import { isSimulationCase } from "@/lib/simulation/case-schema";
import { playView } from "./views";

// The one place that decides which view of a case a browser gets once the viewer's plan includes it (./views.ts):
// the whole case for someone who has completed it before, and for admins; the play view for everyone else. Used by
// both routes that send a case to the browser (GET /api/cases/[id] and POST /api/cases/[id]/start).

async function completedBefore(userId: string | null, caseId: string): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabaseServer.from("case_attempts").select("id").eq("user_id", userId).eq("case_id", caseId).limit(1);
  return !error && (data?.length ?? 0) > 0;
}

export async function caseForBrowser(caseData: Record<string, any>, userId: string | null): Promise<Record<string, any>> {
  // The classic three-step flow (a case that opts out of the bedside encounter) reads the whole case in the browser.
  if (!isSimulationCase(caseData)) return caseData;
  if ((await isAdmin(userId)) || (await completedBefore(userId, caseData.id))) return caseData;
  return playView(caseData);
}
