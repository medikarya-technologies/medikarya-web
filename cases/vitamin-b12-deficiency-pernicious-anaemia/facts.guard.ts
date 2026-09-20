import { PatientFacts, CaseResponse } from '../types';

export function handleFactQuestion(question: string, facts: PatientFacts): CaseResponse | null {
    // LLM handles all fact questions via brief + prompt + history
    return null;
}
