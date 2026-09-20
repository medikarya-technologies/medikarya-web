import { CaseModule } from './types';
import { neonatalJaundiceModule } from './neonatal-jaundice-breastmilk';
import { viralGastroenteritisModule } from './viral-gastroenteritis';
import { severeMigraineModule } from './severe-migraine-with-aura';
import { ironDeficiencyAnemiaModule } from './iron-deficiency-anemia-in-pregnancy';
import { nonToxicNodularGoitreModule } from './non-toxic-nodular-goitre-neck-swelling';
import { completeHeartBlockModule } from './complete-heart-block-syncope';
import { vitaminB12DeficiencyModule } from './vitamin-b12-deficiency-pernicious-anaemia';
import { malariaModule } from './malaria-returning-traveller-fever';
import { adpkdModule } from './autosomal-dominant-polycystic-kidney-disease';

const caseRegistry: Record<string, CaseModule> = {
    'neonatal-jaundice-breastmilk': neonatalJaundiceModule,
    'viral-gastroenteritis': viralGastroenteritisModule,
    'severe-migraine-with-aura': severeMigraineModule,
    'iron-deficiency-anemia-in-pregnancy': ironDeficiencyAnemiaModule,
    'non-toxic-nodular-goitre-neck-swelling': nonToxicNodularGoitreModule,
    'complete-heart-block-syncope': completeHeartBlockModule,
    'vitamin-b12-deficiency-pernicious-anaemia': vitaminB12DeficiencyModule,
    'malaria-returning-traveller-fever': malariaModule,
    'autosomal-dominant-polycystic-kidney-disease': adpkdModule,
};

export function getCaseModule(caseId: string): CaseModule | null {
    return caseRegistry[caseId] || null;
}
