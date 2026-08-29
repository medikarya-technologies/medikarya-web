import { PatientFacts, CaseResponse } from '../types';

export function handleFactQuestion(question: string, facts: PatientFacts): CaseResponse | null {
    // No keyword guards at all – let the LLM handle everything via brief + prompt + history
    return null;
}
