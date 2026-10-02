import { CaseModule } from './types';
import { currentCaseId } from '@/lib/cases/renamed-ids';
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
    '4-week-old-infant-with-yellow-eyes-and-face': neonatalJaundiceModule,
    '2-year-old-boy-with-vomiting-and-watery-diarrhea': viralGastroenteritisModule,
    '21-year-old-woman-with-visual-disturbances-and-headache': severeMigraineModule,
    '24-year-old-pregnant-woman-with-fatigue-and-breathlessness': ironDeficiencyAnemiaModule,
    '54-year-old-woman-with-a-neck-swelling': nonToxicNodularGoitreModule,
    '72-year-old-man-with-recurrent-fainting': completeHeartBlockModule,
    '63-year-old-woman-with-tiredness-and-numb-feet': vitaminB12DeficiencyModule,
    '24-year-old-man-with-fever-after-travel': malariaModule,
    '49-year-old-woman-with-flank-pain-and-blood-in-urine': adpkdModule,
};

export function getCaseModule(caseId: string): CaseModule | null {
    return caseRegistry[currentCaseId(caseId)] || null;
}
