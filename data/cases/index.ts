import { supabaseServer } from '@/lib/supabase/server';

export interface CaseMetadata {
  id: string;
  title: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTime: number;
  tags: string[];
  displayTitle: string;
  displayDescription: string;
  displayTags: string[];
  xpReward: number;
  completionRate?: number;
  createdAt: string;
  updatedAt: string;
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

export async function getCases(): Promise<CaseMetadata[]> {
  const { data, error } = await supabaseServer
    .from('cases')
    .select('id, title, category, difficulty, estimated_time, status, created_at, updated_at, case_json')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error("Error fetching cases metadata from Supabase:", error);
    return [];
  }

  // Map database columns back to the CaseMetadata format expected by the frontend
  return data.map((row) => {
    // Extract remaining metadata fields not explicitly broken out into columns from case_json
    const { tags, description, xpReward, completionRate, displayTitle, displayDescription, displayTags } = row.case_json || {};

    return {
      id: row.id,
      title: row.title,
      displayTitle: displayTitle || row.title,
      displayDescription: displayDescription || description || `Practice your skills with this ${row.difficulty.toLowerCase()} case in ${row.category}.`,
      displayTags: displayTags || tags || [],
      category: row.category,
      difficulty: row.difficulty as 'Beginner' | 'Intermediate' | 'Advanced',
      estimatedTime: row.estimated_time,
      tags: tags || [],
      description: description || '',
      xpReward: xpReward || 50,
      completionRate: completionRate,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString()
    };
  });
}

export async function getCaseById(id: string): Promise<CaseData | null> {
  try {
    const { data, error } = await supabaseServer
      .from('cases')
      .select('case_json')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error(`Error fetching case ${id} from Supabase:`, error);
      return null;
    }

    return data.case_json as CaseData;
  } catch (error) {
    console.error(`Unexpected error reading case ${id}:`, error);
    return null;
  }
}
