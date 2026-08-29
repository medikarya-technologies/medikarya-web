import { CaseModule } from '../types';
import { handleFactQuestion } from './facts.guard';
import { getDiagnosisLogic } from './diagnosis.rules';
import { getInvestigationLogic } from './investigations.rules';

export const nonToxicNodularGoitreModule: CaseModule = {
    handleFactQuestion,
    getDiagnosisLogic,
    getInvestigationLogic: (caseData: any) => getInvestigationLogic(caseData),
    getAllowedTopics: () => ["goitre", "thyroid", "neck swelling", "dysphagia", "hoarseness", "dyspnea"],
    getCaseId: () => "non-toxic-nodular-goitre-neck-swelling"
};
