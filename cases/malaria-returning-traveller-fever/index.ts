import { CaseModule } from '../types';
import { handleFactQuestion } from './facts.guard';
import { getDiagnosisLogic } from './diagnosis.rules';
import { getInvestigationLogic } from './investigations.rules';

export const malariaModule: CaseModule = {
    handleFactQuestion,
    getDiagnosisLogic,
    getInvestigationLogic: (caseData: any) => getInvestigationLogic(caseData),
    getAllowedTopics: () => ["fever", "malaria", "nigeria", "travel", "rigors", "shivering", "chills", "blood film", "parasite", "plasmodium"],
    getCaseId: () => "malaria-returning-traveller-fever"
};
