import { CaseModule } from '../types';
import { handleFactQuestion } from './facts.guard';
import { getDiagnosisLogic } from './diagnosis.rules';
import { getInvestigationLogic } from './investigations.rules';

export const vitaminB12DeficiencyModule: CaseModule = {
    handleFactQuestion,
    getDiagnosisLogic,
    getInvestigationLogic: (caseData: any) => getInvestigationLogic(caseData),
    getAllowedTopics: () => ["anaemia", "vitamin b12", "pernicious anaemia", "numbness", "neuropathy", "fatigue", "macrocytosis"],
    getCaseId: () => "vitamin-b12-deficiency-pernicious-anaemia"
};
