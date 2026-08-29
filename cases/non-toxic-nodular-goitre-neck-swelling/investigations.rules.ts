import { InvestigationRules } from '../types';
import { buildInvestigationRulesFromCaseData } from '../lib/investigation-result-builder';

export function getInvestigationLogic(caseData: any): InvestigationRules {
    return buildInvestigationRulesFromCaseData(caseData);
}
