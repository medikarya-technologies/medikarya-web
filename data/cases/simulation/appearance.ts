// How the classic cases look at the bedside, where the case itself doesn't say.
//
// Most classic cases document their patient's appearance (a general examination
// with pallor / jaundice / general condition, a documented neck swelling, a
// structured jaundice fact), and `deriveAppearance` reads that. These are the
// cases that document NOTHING usable, so their look is drafted here from what the
// case does record.
//
//   >>> DRAFTS FOR CLINICAL REVIEW. Each entry says what it was drafted from. <<<
//
// Keyed by case id, applied on top of the case wherever it is read from (the case
// itself lives in the database), and overridden by an `appearance` block written
// in the case's own JSON.

import type { AppearanceSpec } from "../../../lib/simulation/appearance";

export const appearanceOverlays: Readonly<Record<string, AppearanceSpec>> = {
    // The case's own labs: Hb 8.2 g/dL, MCV 72 (moderate microcytic anaemia), and the patient reports
    // tiredness, weakness, light-headedness and exertional breathlessness. Pallor is the cardinal
    // sign of this presentation but the case does not record an examination.
    "iron-deficiency-anemia-in-pregnancy": {
        pallor: 2,
        expression: "tired",
        note: "Looks pale and tired.",
    },

    // The history lists "moderate dehydration" as an associated symptom, the child is weak, off his
    // food and febrile (38.5 °C). Sunken eyes are the textbook sign of moderate dehydration.
    "viral-gastroenteritis": {
        expression: "tired",
        sunken_eyes: 1,
        note: "Tired, unwell-looking child. Eyes look a little sunken.",
    },
};
