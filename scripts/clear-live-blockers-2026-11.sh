#!/usr/bin/env bash
# Main project (srsqsl…). Run from the repo root on your machine: bash scripts/clear-live-blockers-2026-11.sh
#
# Clears the release blockers on the held live emergencies that published guidelines settle (November 2026 check).
# Each line records who settled it and the source. It never switches a case on; that is the last step, below.
# Every plan was re-checked first: check-live-plan 0 errors; correct care 100 and stabilised; untreated deteriorates;
# harmful treatments flagged; npm run test:sim 1129 pass.
set -euo pipefail
RB="node --env-file=.env.local node_modules/ts-node/dist/bin.js --project scripts/tsconfig.migrate.json scripts/release-blocker.ts"
WHO="MediKarya team, from published guidelines (Nov 2026)"

$RB 34-year-old-man-with-drooping-eyelids-and-trouble-swallowing clear snakebite_asv_dose "$WHO" \
  "Checked against MoHFW Standard Treatment Guidelines, Management of Snake Bite: neuroparalytic bite 10 vials as an infusion over 30 min, a second 10 vials if no improvement within the first hour (repeat after 2-3 h if signs relapse); no test dose (no predictive value); AN trial stopped after 3 doses without response (probable krait), then calcium gluconate 10 mL IV 6-hourly (added to basis). The plan matches."

$RB 45-year-old-woman-with-fever-who-has-become-confused clear septic_dopamine_role "$WHO" \
  "Kept harmful. SSC 2021: noradrenaline first line; SSC 2012/2016 keep dopamine for highly selected patients with low risk of tachyarrhythmia or with bradycardia. She arrives at HR 124; SOAP II (NEJM 2010) found more arrhythmias with dopamine. In this patient it is a mistake."

$RB 24-year-old-man-brought-in-vomiting-and-drowsy clear op_endpoints_review "$WHO" \
  "End points SBP above 80, HR above 80, clear chest, as in Eddleston's protocol (Crit Care 2004; Clin Toxicol 2004; Lancet 2008), also used in Indian ICU practice: doubling doses every 5 min with reassessment before each, then an infusion of 10-20% of the loading dose per hour; non-depolarising relaxant for intubation. Chest clearing with the third dose, the 10-minute infusion window and the ventilator's effect on the monitor are teaching compressions, stated in basis."

$RB 32-year-old-man-brought-in-fitting clear se_treatment_sequence "$WHO" \
  "Engine fixed and tested: the second-line drug requires two lorazepam doses (NICE NG217 7.1.9) and is refused before them (live-plan-state-cases test: needs_first). Sequence as NICE NG217."

$RB 32-year-old-man-brought-in-fitting clear se_access_and_reassessment "$WHO" \
  "IV lorazepam first where IV access is available (NICE NG217); IM or buccal midazolam only without it (AES 2016 Level A, RAMPART NEJM 2012; ICMR epilepsy STW: buccal or intranasal midazolam out of hospital). In this case IV access never fails, and the tray points to midazolam as the alternative. SpO2 94% matches the BTS oxygen target of 94-98%."

$RB 36-year-old-man-with-sudden-breathlessness clear anaphylaxis_recovery_endpoints "$WHO" \
  "Engine fixed and tested: stabilisation on any path requires the end points (SBP 90 or more, SpO2 92 or more, airway settled); a late rescue from peri-arrest stays unstabilised (live-plan-state-cases tests)."

$RB 58-year-old-man-who-is-sweaty-and-hard-to-wake clear hypo_glucagon_pathway "$WHO" \
  "Option (a). JBDS: glucagon 1 mg IM only when IV access cannot be obtained; up to 15 min; may be ineffective after a sulfonylurea. In this case IV access never fails, so IV glucose is the way to recover him and glucagon stays supportive; the recheck after glucagon tells the student to give IV glucose."

echo
echo "Left open on purpose: 36-year-old-man-with-sudden-breathlessness anaphylaxis_posture_and_airway (two questions for the professor)."
echo
echo "Your decisions (same as you did for dengue). Run these only if you agree:"
echo "  DKA and septic shock, infusion_model_limitation: the fluid engine now steps rates down, stops and reassesses."
echo "  All seven, clinical_review: team-written cases need no clinician sign-off (CLAUDE.md); checks above."
echo "Then switch each on: node --env-file=.env.local node_modules/ts-node/dist/bin.js --project scripts/tsconfig.migrate.json scripts/set-live.ts <case id> on"
