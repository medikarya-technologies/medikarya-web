import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The MediKarya Case Studio (a separate app and Supabase project, where students write case sheets and faculty
// review them), read by the admin converter. This module only ever reads from it.

let client: SupabaseClient | null = null;

/** null when STUDIO_SUPABASE_URL / STUDIO_SUPABASE_SERVICE_KEY are not set (e.g. a deploy without the converter). */
function studio(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.STUDIO_SUPABASE_URL;
  const key = process.env.STUDIO_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function studioConfigured(): boolean {
  return studio() !== null;
}

type Json = Record<string, any>;

export interface StudioCaseSummary {
  id: string;
  title: string;
  status: string;
  specialty: string;
  difficulty: string;
  author: string | null;
  createdAt: string;
  /** The studio's own "added to platform" switch. */
  addedToPlatform: boolean;
  /** The author allowed MediKarya to publish it (ticked on submit, or recorded by an admin). */
  publishConsent: boolean;
  consentNote: string | null;
}

export interface StudioCase extends StudioCaseSummary {
  patient: { age: number | null; sex: string | null; occupation: string | null; religion: string | null };
  sections: Record<string, unknown>;
  /** What must never reach the playable case: the patient's name and case number, and their address. */
  identifiers: { names: string[]; places: string[] };
}

const SECTIONS = ["history", "general_physical_examination", "systemic_examination", "local_examination", "diagnosis", "investigations_info", "custom_fields"] as const;

function specialtyOf(row: Json): string {
  const custom = row.custom_specialty ?? row.patient_details?.custom_specialty;
  if (row.specialty === "other" && custom) return String(custom);
  return String(row.specialty ?? "other").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function summary(row: Json): StudioCaseSummary {
  const d = row.patient_details?.declarations ?? {};
  return {
    id: row.id,
    title: row.title ?? "Untitled",
    status: row.status,
    specialty: specialtyOf(row),
    difficulty: row.difficulty ?? "intermediate",
    author: row.original_author_name || null,
    createdAt: row.created_at,
    addedToPlatform: !!row.added_to_platform,
    publishConsent: d.publish_consent === true,
    consentNote: typeof d.consent_note === "string" ? d.consent_note : null,
  };
}

export async function listStudioCases(): Promise<StudioCaseSummary[]> {
  const db = studio();
  if (!db) return [];
  const { data, error } = await db
    .from("cases")
    .select("id, title, status, specialty, difficulty, original_author_name, created_at, added_to_platform, patient_details")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(summary);
}

// Rich-text fields are stored as HTML; the model reads plain text.
function plain(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
}

function redactor(names: string[], places: string[]) {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const word = (w: string) => new RegExp(`\\b${escape(w)}\\b`, "gi");
  const patterns: Array<[RegExp, string]> = [
    // every part of the name ("Rubi Devi" hides "Rubi" and "Devi"), and the case number
    ...names.flatMap((n) => n.split(/\s+/).filter((w) => w.length >= 2)).map((w): [RegExp, string] => [word(w), "the patient"]),
    ...places.flatMap((p) => p.split(/[^A-Za-z]+/).filter((w) => w.length >= 4)).map((w): [RegExp, string] => [word(w), "[place]"]),
  ];
  const run = (v: unknown): unknown => {
    if (typeof v === "string") return patterns.reduce((text, [re, to]) => text.replace(re, to), v);
    if (Array.isArray(v)) return v.map(run);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, run(x)]));
    return v;
  };
  return run;
}

export async function getStudioCase(id: string): Promise<StudioCase | null> {
  const db = studio();
  if (!db) return null;
  const { data: row, error } = await db.from("cases").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const pd: Json = row.patient_details ?? {};
  // A case number that is only digits ("17") says nothing in the text and would clash with ages and doses.
  const names = [pd.patient_name, pd.case_no, pd.patient_id].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0 && /[A-Za-z]/.test(v)
  );
  const places = [pd.address, pd.location].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  // The case sheet is sent to the model with the patient's name and address taken out of the text as well.
  const hide = redactor(names, places);
  const sections: Record<string, unknown> = {};
  for (const k of SECTIONS) if (row[k] != null) sections[k] = hide(plain(row[k]));

  return {
    ...summary(row),
    patient: {
      age: typeof pd.age === "number" ? pd.age : null,
      sex: pd.sex ?? pd.gender ?? null,
      occupation: pd.occupation ?? null,
      religion: pd.religion ?? null,
    },
    sections,
    identifiers: { names, places },
  };
}
