import { CaseModule } from './types';
import { neonatalJaundiceModule } from './neonatal-jaundice-breastmilk';
import { viralGastroenteritisModule } from './viral-gastroenteritis';
import { severeMigraineModule } from './severe-migraine-with-aura';
import { ironDeficiencyAnemiaModule } from './iron-deficiency-anemia-in-pregnancy';
import { nonToxicNodularGoitreModule } from './non-toxic-nodular-goitre-neck-swelling';

const caseRegistry: Record<string, CaseModule> = {
    'neonatal-jaundice-breastmilk': neonatalJaundiceModule,
    'viral-gastroenteritis': viralGastroenteritisModule,
    'severe-migraine-with-aura': severeMigraineModule,
    'iron-deficiency-anemia-in-pregnancy': ironDeficiencyAnemiaModule,
    'non-toxic-nodular-goitre-neck-swelling': nonToxicNodularGoitreModule,
};

export function getCaseModule(caseId: string): CaseModule | null {
    return caseRegistry[caseId] || null;
}
