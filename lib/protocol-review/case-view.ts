import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

// The case as a student meets it, laid out for a reviewer: history, examination, results, the expert walkthrough and
// the teaching points. Read live from the case, so the review page always shows what students see.

export interface CaseView {
  title: string;
  sections: Array<{ title: string; rows: Array<{ label: string; value: string }> }>;
  tests: Array<{ name: string; lines: string[] }>;
  walkthrough: string;
  keyPoints: string[];
}

const label = (k: string) => {
  if (k.toLowerCase() === "spo2") return "SpO2";
  const t = k.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Any fact (text, list or nested object) as label/value rows. */
function rows(value: unknown, name?: string): Array<{ label: string; value: string }> {
  if (value == null || value === "") return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [{ label: name ?? "", value: String(value) }];
  if (Array.isArray(value)) return value.length ? [{ label: name ?? "", value: value.map(String).join("; ") }] : [];
  // A named group keeps its name: "Medicines (current)", not just "Current".
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => rows(v, name ? `${name} (${label(k).toLowerCase()})` : label(k)));
}

export async function loadCaseView(caseId: string): Promise<CaseView | null> {
  const { data, error } = await supabaseServer.from("cases").select("case_json").eq("id", caseId).maybeSingle();
  if (error) throw error;
  const c = data?.case_json as Record<string, any> | undefined;
  if (!c) return null;
  const f = (c.patient_facts ?? {}) as Record<string, unknown>;
  const s = (f.symptoms ?? {}) as Record<string, unknown>;
  const id = (f.identity ?? {}) as Record<string, unknown>;

  const sections: CaseView["sections"] = [
    {
      title: "Who he is and why he came",
      rows: [
        { label: "Patient", value: [id.name, id.age_years ? `${id.age_years} years` : "", id.gender, id.occupation, id.location].filter(Boolean).join(", ") },
        ...rows(f.chief_complaint, "Presenting complaint"),
        ...rows(f.who_is_speaking, "Who gives the history"),
        ...rows(c.patient_text_brief, "In his own words"),
      ],
    },
    {
      title: "History",
      rows: [
        ...rows(Object.fromEntries(Object.entries(s).filter(([k]) => k !== "positive" && k !== "negative"))),
        ...rows(s.negative, "He does not have"),
        ...rows(f.drug_history, "Medicines"),
        ...rows(f.past_history, "Past history"),
        ...rows(f.family_history, "Family and contacts"),
        ...rows(f.personal_history),
        ...rows(f.investigations_before, "Earlier test"),
      ],
    },
    {
      title: "Examination",
      rows: [
        ...rows(f.general_physical_examination),
        ...rows(f.cardiovascular_examination, "Heart"),
        ...rows(f.respiratory_examination, "Chest"),
        ...rows(f.abdominal_examination, "Abdomen"),
        ...rows(f.neurological_examination, "Nervous system"),
      ],
    },
  ].map((sec) => ({ ...sec, rows: sec.rows.filter((r) => r.value) }));

  const tests: CaseView["tests"] = (c.tests ?? []).map((t: any) => {
    const r = t.result ?? {};
    const values: string[] = (r.values ?? []).map((v: any) => `${v.parameter}: ${v.value}${v.unit ? " " + v.unit : ""}${v.referenceRange ? ` · normal ${v.referenceRange}` : ""}`);
    return { name: String(t.name ?? t.id), lines: values.length ? values : [String(r.summary ?? r.interpretation ?? "")].filter(Boolean) };
  });

  return {
    title: String(c.displayTitle ?? c.title ?? caseId),
    sections,
    tests,
    walkthrough: String(c.walkthrough ?? ""),
    keyPoints: Array.isArray(c.discussion?.keyPoints) ? c.discussion.keyPoints.map(String) : [],
  };
}
