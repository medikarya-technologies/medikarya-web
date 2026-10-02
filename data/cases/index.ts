import { unstable_cache } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { bundledSimulationCases, getBundledSimulationCase } from './simulation';
import { upgradeLegacyCase } from '@/lib/simulation/legacy-adapter';
import { isSimulationCase } from '@/lib/simulation/case-schema';
import { appearanceOverlays } from './simulation/appearance';
import { currentCaseId, formerCaseId } from '@/lib/cases/renamed-ids';

export interface CaseMetadata {
  id: string;
  title: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTime: number;
  tags: string[];
  description?: string;
  displayTitle: string;
  displayDescription: string;
  displayTags: string[];
  xpReward: number;
  completionRate?: number;
  createdAt: string;
  updatedAt: string;
  /** Who the patient is (age and gender only): enough to draw them in the library, nothing about the illness. */
  patient?: { age?: number; gender?: string };
  /** An authored live simulation (treatments, a patient who changes) rather than a consultation. */
  live?: boolean;
}

export interface CaseCardProps extends Omit<CaseMetadata, 'createdAt' | 'updatedAt'> {
  // Additional UI-specific properties can be added here
}

export interface CaseData extends CaseMetadata {
  patient: any;
  patient_text_brief: string;
  patient_facts: any; // Structured object with variable keys
  questions: any[];
  discussion: any;
  walkthrough?: string;
  ai_role?: {
    speaker: string;
    first_person_description: string;
    age_group: string;
    can_speak_for_self: boolean;
    language_style: string;
    emotional_tone: string;
    key_constraints: string[];
  };
  ai_examples?: {
    doctor: string;
    patient: string;
  }[];
}

/** Age and gender, and nothing else, from a case's patient block. */
function patientBasics(patient: any): { age?: number; gender?: string } | undefined {
  if (!patient || typeof patient !== 'object') return undefined;
  const age = typeof patient.age === 'number' && Number.isFinite(patient.age) ? patient.age : undefined;
  const gender = typeof patient.gender === 'string' ? patient.gender : undefined;
  return age === undefined && gender === undefined ? undefined : { age, gender };
}

/** Library card for a simulation case that ships with the app. */
function bundledMetadata(c: Record<string, any>): CaseMetadata {
  // The list goes to every student's browser: a case's real title, tags and description name its diagnosis, so
  // those three carry the display versions here (see toMetadata).
  const displayTitle = c.displayTitle || 'Patient case';
  return {
    id: c.id,
    title: displayTitle,
    displayTitle,
    displayDescription: c.displayDescription || '',
    displayTags: c.displayTags || [],
    category: c.category || 'Uncategorized',
    difficulty: c.difficulty || 'Advanced',
    estimatedTime: c.estimatedTime || 25,
    tags: c.displayTags || [],
    description: c.displayDescription || '',
    xpReward: c.xpReward || 50,
    createdAt: c.createdAt || '2026-01-01T00:00:00.000Z',
    updatedAt: c.updatedAt || '2026-01-01T00:00:00.000Z',
    patient: patientBasics(c.patient),
    live: isSimulationCase(c),
  };
}

/** Bundled cases the database doesn't already have (the database wins on a shared id). */
function withBundled(fromDatabase: CaseMetadata[]): CaseMetadata[] {
  const known = new Set(fromDatabase.map((c) => c.id));
  return [...fromDatabase, ...bundledSimulationCases.filter((c) => !known.has(c.id)).map(bundledMetadata)];
}

// What the list needs out of a case's JSON, and nothing else. Reading the whole `case_json` of every case
// (about 150 KB for nine cases) on every page, just to take a title and a few tags from it, made each
// dashboard page slower; these paths bring back about 8 KB with identical values.
const CASE_LIST_COLUMNS = [
  'id', 'title', 'category', 'difficulty', 'estimated_time', 'status', 'created_at', 'updated_at',
  'displayTitle:case_json->>displayTitle',
  'displayDescription:case_json->>displayDescription',
  'description:case_json->>description',
  'xpReward:case_json->xpReward',
  'completionRate:case_json->completionRate',
  'tags:case_json->tags',
  'displayTags:case_json->displayTags',
  'patientAge:case_json->patient->age',
  'patientGender:case_json->patient->>gender',
  // an authored simulation is recognised by these three (see isSimulationCase); a classic case has none of them
  'initialState:case_json->initial_state',
  'eventRules:case_json->event_rules',
  'actionConsequences:case_json->action_consequences',
].join(', ');

interface CaseListRow {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  estimated_time: number;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  displayTitle: string | null;
  displayDescription: string | null;
  description: string | null;
  xpReward: number | null;
  completionRate: number | null;
  tags: string[] | null;
  displayTags: string[] | null;
  patientAge: number | null;
  patientGender: string | null;
  initialState: unknown;
  eventRules: unknown;
  actionConsequences: unknown;
}

function toMetadata(row: CaseListRow): CaseMetadata {
  const difficulty = (row.difficulty || 'Intermediate') as CaseMetadata['difficulty'];
  const age = typeof row.patientAge === 'number' && Number.isFinite(row.patientAge) ? row.patientAge : undefined;
  const gender = typeof row.patientGender === 'string' ? row.patientGender : undefined;

  // The list goes to every student's browser. A case's real title, tags and description name its diagnosis, so
  // `title`, `tags` and `description` carry the display versions: nothing here says what the patient has.
  const displayTitle = row.displayTitle || 'Patient case';
  const displayDescription = row.displayDescription || `Practice your skills with this ${difficulty.toLowerCase()} case in ${row.category}.`;
  const displayTags = row.displayTags || [];
  return {
    id: currentCaseId(row.id), // the patient-describing id, even before the rows are renamed (lib/cases/renamed-ids.ts)
    title: displayTitle,
    displayTitle,
    displayDescription,
    displayTags,
    category: row.category,
    difficulty,
    estimatedTime: row.estimated_time,
    tags: displayTags,
    description: displayDescription,
    xpReward: row.xpReward || 50,
    completionRate: row.completionRate ?? undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    patient: age === undefined && gender === undefined ? undefined : { age, gender },
    live: isSimulationCase({ initial_state: row.initialState, event_rules: row.eventRules, action_consequences: row.actionConsequences }),
  };
}

// The list changes when a case is added, not from one request to the next, and four pages ask for it
// (home, library, progress, profile): it is kept for a minute, so moving between them costs no query at all. A
// failed query throws, so a failure is never kept. (A newly added case shows up within a minute.)
const cachedCaseList = unstable_cache(
  async (): Promise<CaseMetadata[]> => {
    // Only published cases: drafts (from the studio converter, /admin/studio) are for admins to play-test.
    const { data, error } = await supabaseServer
      .from('cases')
      .select(CASE_LIST_COLUMNS)
      .eq('status', 'published')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as CaseListRow[]).map(toMetadata);
  },
  ['case-list-v5'],
  { revalidate: 60, tags: ['cases'] }
);

export async function getCases(): Promise<CaseMetadata[]> {
  try {
    return withBundled(await cachedCaseList());
  } catch (error) {
    console.error("Error fetching cases metadata from Supabase:", error);
    return withBundled([]);
  }
}

/**
 * A case as the encounter runs it. Classic cases are upgraded to the bedside
 * encounter (live monitor, clock, examination, investigations that come back
 * after a wait, assists, timeline) using only the case's own data; see
 * lib/simulation/legacy-adapter.ts. Two ways back to the classic three-step flow:
 * set CLASSIC_CASE_FLOW=true to switch it off everywhere, or add
 * `"experience": "classic"` to a case to opt that one case out.
 */
function forEncounter(caseJson: CaseData): CaseData {
  if (process.env.CLASSIC_CASE_FLOW === 'true') return caseJson;
  return upgradeLegacyCase(caseJson as any, { appearance: appearanceOverlays[caseJson.id] }) as CaseData;
}

export async function getCaseById(requestedId: string): Promise<CaseData | null> {
  // Ten cases were renamed (lib/cases/renamed-ids.ts). A case is found under its new id or its old one, so an old
  // link still works and so does a database whose rows have not been renamed yet; it always goes by the new id.
  const id = currentCaseId(requestedId);
  const former = formerCaseId(id);
  try {
    const { data, error } = await supabaseServer
      .from('cases')
      .select('id, case_json')
      .in('id', former ? [id, former] : [id]);

    const row = data?.find((r) => r.id === id) ?? data?.[0];
    if (!error && row) return forEncounter({ ...(row.case_json as CaseData), id });

    // Not in the database: fall back to a case that ships with the app.
    const bundled = getBundledSimulationCase(id);
    if (bundled) return bundled as unknown as CaseData;

    if (error) console.error(`Error fetching case ${id} from Supabase:`, error);
    return null;
  } catch (error) {
    const bundled = getBundledSimulationCase(id);
    if (bundled) return bundled as unknown as CaseData;
    console.error(`Unexpected error reading case ${id}:`, error);
    return null;
  }
}
