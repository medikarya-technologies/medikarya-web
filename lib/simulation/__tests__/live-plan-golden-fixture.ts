// A synthetic live case for the golden tests: a dehydrated toddler with a plan that uses only the version-1 fields.
// Its full compiled output is committed, so the backward-compatibility test runs on any checkout, even without the
// real cases (data/cases is not in git).

export const goldenFixtureCase = {
    id: "golden-fixture-child",
    title: "Acute gastroenteritis with severe dehydration",
    displayTitle: "2-year-old boy with vomiting and loose stools",
    category: "Paediatrics",
    difficulty: "Intermediate",
    patient: {
        name: "Aarav",
        age: 2,
        gender: "Male",
        chiefComplaint: "Vomiting and loose stools for 3 days",
        vitalSigns: {
            heartRate: { value: 148, unit: "bpm" },
            bloodPressure: { systolic: 86, diastolic: 54, unit: "mmHg" },
            respiratoryRate: { value: 34, unit: "/min" },
            temperature: { value: 37.9, unit: "°C" },
            oxygenSaturation: { value: 97, unit: "%" },
        },
    },
    patient_facts: { general_physical_examination: { hydration: "Sunken eyes, dry mucosa, skin pinch goes back slowly" } },
    tests: [{ id: "serum-electrolytes", name: "Serum electrolytes", category: "Laboratory", result: { summary: "Sodium 131", values: [], interpretation: "Mild hyponatraemia" } }],
    evaluation_config: { diagnosis: { accepted_primary: ["Acute gastroenteritis with severe dehydration"] } },
};

export const goldenFixturePlan = {
    version: 1,
    origin: "ai",
    status: "proposed",
    summary: "Untreated, the child goes from compensated to decompensated hypovolaemic shock within a quarter of an hour.",
    setting: "Paediatric emergency",
    critical_window_minutes: 8,
    time_limit_minutes: 20,
    arrival: { consciousness: "anxious", stability: "unstable" },
    stages: [
        { id: "compensated_shock", name: "Compensated shock", at_minutes: 6, vitals: { hr: 164, sbp: 80, dbp: 50, rr: 40 }, consciousness: "drowsy", nurse_says: "Doctor, he is getting sleepy and his hands are cold. Pulse {hr}." },
        { id: "decompensated", name: "Decompensated shock", at_minutes: 12, vitals: { hr: 178, sbp: 62, dbp: 38, rr: 48, spo2: 92 }, consciousness: "altered", stability: "critical", nurse_says: "I can barely feel his pulse. BP {bp}." },
    ],
    treatments: [
        { id: "iv_access", label: "IV access ×2", detail: "Two large-bore (18G) cannulae", group: "circulation", role: "essential", within_minutes: 5, says: "Two cannulae in on the second attempt; bloods sent.", why: "No fluids can be given without access." },
        { id: "fluid_bolus_20ml_kg", label: "IV fluid bolus", detail: "20 mL/kg Ringer's lactate over 15 minutes", group: "circulation", role: "essential", within_minutes: 8, effect: { hr: -14, sbp: 8, dbp: 5 }, says: "The bolus is running. His pulse is coming down.", why: "Shock in a dehydrated child is treated with a rapid isotonic bolus." },
        { id: "oxygen_supplemental", label: "Supplemental oxygen", detail: "Nasal cannula or mask, titrate SpO₂ to 94–98%", group: "airway", role: "supportive", effect: { spo2: 2 }, says: "Oxygen on by mask." },
        { id: "furosemide_iv", label: "Furosemide IV", detail: "40 mg IV", group: "medications", role: "harmful", effect: { sbp: -10, dbp: -6, hr: 8 }, says: "Furosemide given. His pressure falls further.", why: "A diuretic in a volume-depleted child deepens the shock." },
        { id: "ondansetron_4mg", label: "Ondansetron IV", detail: "4 mg IV for nausea", group: "medications", role: "supportive", says: "Ondansetron given; the vomiting settles." },
    ],
    stabilised_by: ["iv_access", "fluid_bolus_20ml_kg"],
    recovery: { after_minutes: 4, vitals: { hr: 126, sbp: 94, dbp: 58, spo2: 99, rr: 30 }, consciousness: "alert", nurse_says: "He is waking up and asking for his mother. Pulse {hr}, BP {bp}." },
    basis: ["Timings: untreated hypovolaemic shock in a toddler."],
};
