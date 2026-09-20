import { CaseModule } from '../types';
import { handleFactQuestion } from './facts.guard';
import { getDiagnosisLogic } from './diagnosis.rules';
import { getInvestigationLogic } from './investigations.rules';

export const completeHeartBlockModule: CaseModule = {
    handleFactQuestion,
    getDiagnosisLogic,
    getInvestigationLogic: (caseData: any) => getInvestigationLogic(caseData),
    getAllowedTopics: () => ["syncope", "fainting", "bradycardia", "heart block", "ECG", "pacemaker", "dizziness"],
    getCaseId: () => "complete-heart-block-syncope"
};
