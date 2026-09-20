import { PatientFacts, CaseResponse } from '../types';

export function handleFactQuestion(question: string, facts: PatientFacts): CaseResponse | null {
    // No keyword guards — let the LLM handle all fact questions via brief + prompt + history
    return null;
}
