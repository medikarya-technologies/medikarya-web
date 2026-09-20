import { CaseModule } from '../types';
import { handleFactQuestion } from './facts.guard';
import { getDiagnosisLogic } from './diagnosis.rules';
import { getInvestigationLogic } from './investigations.rules';

export const adpkdModule: CaseModule = {
    handleFactQuestion,
    getDiagnosisLogic,
    getInvestigationLogic: (caseData: any) => getInvestigationLogic(caseData),
    getAllowedTopics: () => ["kidney", "polycystic", "ADPKD", "flank pain", "haematuria", "blood in urine", "hypertension", "cyst", "transplant", "aneurysm"],
    getCaseId: () => "autosomal-dominant-polycystic-kidney-disease"
};
