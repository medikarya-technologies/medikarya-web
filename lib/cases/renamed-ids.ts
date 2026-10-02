// The first ten cases had ids that named their diagnosis, which showed in the address bar and in every link to the
// case. They were renamed to describe the patient instead, as cases from the studio converter are
// (scripts/rename_case_ids.sql renames the rows). This is the list of old → new.
//
// It is here for two reasons: an old link or bookmark still opens the case (it is sent on to the new address), and
// the site works whether or not the SQL has been run yet (a case is looked up under either id).
//
// SERVER ONLY in practice: the old ids are the diagnoses, so never import this into a client component.

export const RENAMED_CASE_IDS: Readonly<Record<string, string>> = {
  "viral-gastroenteritis": "2-year-old-boy-with-vomiting-and-watery-diarrhea",
  "neonatal-jaundice-breastmilk": "4-week-old-infant-with-yellow-eyes-and-face",
  "severe-migraine-with-aura": "21-year-old-woman-with-visual-disturbances-and-headache",
  "iron-deficiency-anemia-in-pregnancy": "24-year-old-pregnant-woman-with-fatigue-and-breathlessness",
  "malaria-returning-traveller-fever": "24-year-old-man-with-fever-after-travel",
  "autosomal-dominant-polycystic-kidney-disease": "49-year-old-woman-with-flank-pain-and-blood-in-urine",
  "non-toxic-nodular-goitre-neck-swelling": "54-year-old-woman-with-a-neck-swelling",
  "acute-anterior-stemi": "61-year-old-man-with-severe-chest-pain-and-sweating",
  "vitamin-b12-deficiency-pernicious-anaemia": "63-year-old-woman-with-tiredness-and-numb-feet",
  "complete-heart-block-syncope": "72-year-old-man-with-recurrent-fainting",
};

const FORMER: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(RENAMED_CASE_IDS).map(([old, now]) => [now, old]));

/** The id a case goes by now (an id that was never renamed is returned as it is). */
export function currentCaseId(id: string): string {
  return RENAMED_CASE_IDS[id] ?? id;
}

/** The id this case had before it was renamed; null if it never had another. */
export function formerCaseId(id: string): string | null {
  return FORMER[id] ?? null;
}

/** True for one of the old, diagnosis-naming ids. */
export function isFormerCaseId(id: string): boolean {
  return id in RENAMED_CASE_IDS;
}
