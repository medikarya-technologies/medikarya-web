// =========================
// lib/clinical-catalog.ts
// =========================
// The master investigation catalog: universal reference ranges + standard ED
// turnaround times, shared by every case.
//
// A case layers its own results on top (`investigation_results` in the case
// JSON, keyed by the ids below). Anything the case doesn't define resolves to a
// normal result built from the ranges here — so a student can order from the
// full menu, and ordering restraint is something the scorer can measure.
//
//   Universal   { id: "troponin_i", turnaround: 15, referenceRange: { high: 0.04, unit: "ng/mL" } }
//   Case layer  { "troponin_i": { value: 4.82, status: "critical" } }
//
// Units are conventional (mg/dL, mEq/L, g/dL). Ranges are adult reference
// intervals; where they genuinely differ by sex the parameter carries both.

import type { AssistType } from "./simulation/encounter-events";
import type { ValueStatus } from "./simulation/case-schema";

// ── Types ───────────────────────────────────────────────────────────────────

export type TestCategory =
    | "cardiac"
    | "haematology"
    | "coagulation"
    | "biochemistry"
    | "endocrine"
    | "blood_gas"
    | "urine"
    | "microbiology"
    | "serology"
    | "toxicology"
    | "imaging"
    | "special";

export type TestKind = "lab" | "ecg" | "imaging" | "bedside" | "procedure";

export type Sex = "male" | "female";

export interface CatalogParameter {
    key: string;
    name: string;
    unit: string;
    low?: number;
    high?: number;
    criticalLow?: number;
    criticalHigh?: number;
    male?: { low?: number; high?: number };
    female?: { low?: number; high?: number };
    decimals?: number;
    /** Qualitative parameter: the normal finding, e.g. "Negative". */
    normalText?: string;
}

export interface CatalogTest {
    id: string;
    name: string;
    category: TestCategory;
    kind: TestKind;
    /** Standard emergency-department turnaround, in simulation minutes. */
    turnaroundMinutes: number;
    specimen?: string;
    parameters?: CatalogParameter[];
    /** Extra search terms. */
    aliases?: string[];
    /** Can be ordered again (serial ECG, repeat troponin). */
    repeatable?: boolean;
}

export const CATALOG_CATEGORIES: ReadonlyArray<{ id: TestCategory; label: string }> = [
    { id: "cardiac", label: "Cardiac" },
    { id: "haematology", label: "Haematology" },
    { id: "coagulation", label: "Coagulation" },
    { id: "biochemistry", label: "Biochemistry" },
    { id: "endocrine", label: "Endocrine" },
    { id: "blood_gas", label: "Blood gas" },
    { id: "urine", label: "Urine" },
    { id: "microbiology", label: "Microbiology" },
    { id: "serology", label: "Serology" },
    { id: "toxicology", label: "Toxicology" },
    { id: "imaging", label: "Imaging" },
    { id: "special", label: "Special" },
];

// ── Builders (keep each entry to a line or two) ─────────────────────────────

type Range = Pick<CatalogParameter, "low" | "high" | "criticalLow" | "criticalHigh" | "male" | "female" | "decimals">;

const num = (key: string, name: string, unit: string, low: number | undefined, high: number | undefined, extra: Range = {}): CatalogParameter =>
    ({ key, name, unit, low, high, ...extra });
const qual = (key: string, name: string, normalText: string): CatalogParameter =>
    ({ key, name, unit: "", normalText });

const lab = (
    id: string, name: string, category: TestCategory, turnaroundMinutes: number,
    parameters: CatalogParameter[], extra: Partial<CatalogTest> = {}
): CatalogTest => ({ id, name, category, kind: "lab", turnaroundMinutes, parameters, ...extra });

const study = (
    id: string, name: string, category: TestCategory, kind: TestKind, turnaroundMinutes: number,
    extra: Partial<CatalogTest> = {}
): CatalogTest => ({ id, name, category, kind, turnaroundMinutes, ...extra });

// ── The catalog ─────────────────────────────────────────────────────────────

export const CLINICAL_CATALOG: readonly CatalogTest[] = [
    // ── Cardiac: ECG, markers, imaging, functional tests ──────────────────
    study("ecg_12_lead", "12-lead ECG", "cardiac", "ecg", 1, { repeatable: true, aliases: ["electrocardiogram", "ekg"] }),
    study("ecg_posterior_leads", "Posterior leads ECG (V7–V9)", "cardiac", "ecg", 2, { repeatable: true }),
    study("ecg_right_sided", "Right-sided ECG (V3R–V4R)", "cardiac", "ecg", 2, { repeatable: true }),
    lab("troponin_i", "Troponin I (conventional)", "cardiac", 20, [num("troponin_i", "Troponin I", "ng/mL", undefined, 0.04, { decimals: 2 })], { repeatable: true, specimen: "Serum", aliases: ["cardiac marker", "tni", "trop"] }),
    lab("hs_troponin_i", "High-sensitivity troponin I", "cardiac", 25, [num("hs_troponin_i", "hs-Troponin I", "ng/L", undefined, 26, { male: { high: 34 }, female: { high: 16 }, decimals: 0 })], { repeatable: true, specimen: "Serum", aliases: ["hs-cTnI", "trop"] }),
    lab("hs_troponin_t", "High-sensitivity troponin T", "cardiac", 25, [num("hs_troponin_t", "hs-Troponin T", "ng/L", undefined, 14, { decimals: 0 })], { repeatable: true, specimen: "Serum", aliases: ["hs-cTnT", "trop"] }),
    lab("ck_mb", "CK-MB (mass)", "cardiac", 30, [num("ck_mb", "CK-MB", "ng/mL", undefined, 5, { decimals: 1 })], { repeatable: true, specimen: "Serum", aliases: ["creatine kinase mb"] }),
    lab("myoglobin", "Myoglobin", "cardiac", 30, [num("myoglobin", "Myoglobin", "ng/mL", 25, 72, { decimals: 0 })], { specimen: "Serum" }),
    lab("bnp", "BNP", "cardiac", 25, [num("bnp", "BNP", "pg/mL", undefined, 100, { decimals: 0 })], { specimen: "EDTA plasma", aliases: ["brain natriuretic peptide"] }),
    lab("nt_probnp", "NT-proBNP", "cardiac", 25, [num("nt_probnp", "NT-proBNP", "pg/mL", undefined, 125, { decimals: 0 })], { specimen: "Serum", aliases: ["natriuretic peptide", "heart failure"] }),
    study("echo_pocus", "Bedside echo (POCUS)", "cardiac", "imaging", 10, { aliases: ["point of care ultrasound", "focused cardiac ultrasound", "echocardiography"] }),
    study("echo_tte", "Transthoracic echocardiogram", "cardiac", "imaging", 30, { aliases: ["echocardiography", "2d echo"] }),
    study("echo_tee", "Transoesophageal echocardiogram", "cardiac", "imaging", 60, { aliases: ["tee"] }),
    study("stress_echo", "Stress echocardiography", "cardiac", "procedure", 60),
    study("exercise_stress_test", "Exercise stress test (treadmill)", "cardiac", "procedure", 45, { aliases: ["tmt", "treadmill"] }),
    study("myocardial_perfusion_scan", "Myocardial perfusion scan (SPECT)", "cardiac", "imaging", 180, { aliases: ["mibi", "nuclear stress"] }),
    study("cardiac_mri", "Cardiac MRI", "cardiac", "imaging", 120, { aliases: ["cmr"] }),
    study("ct_coronary_angiography", "CT coronary angiography", "cardiac", "imaging", 60, { aliases: ["ctca"] }),
    study("holter_24h", "24-hour Holter monitor", "cardiac", "procedure", 1440),
    study("event_recorder", "Ambulatory event recorder", "cardiac", "procedure", 1440),
    study("tilt_table_test", "Tilt-table test", "cardiac", "procedure", 90),
    study("ambulatory_bp", "24-hour ambulatory BP monitoring", "cardiac", "procedure", 1440),

    // ── Haematology ────────────────────────────────────────────────────────
    lab("cbc", "Complete blood count (CBC)", "haematology", 15, [
        num("hb", "Haemoglobin", "g/dL", 12.0, 17.5, { male: { low: 13.5, high: 17.5 }, female: { low: 12.0, high: 15.5 }, criticalLow: 7.0, criticalHigh: 20, decimals: 1 }),
        num("rbc", "RBC count", "×10⁶/µL", 4.1, 5.9, { male: { low: 4.5, high: 5.9 }, female: { low: 4.1, high: 5.1 }, decimals: 1 }),
        num("hct", "Haematocrit", "%", 36, 53, { male: { low: 41, high: 53 }, female: { low: 36, high: 46 }, decimals: 1 }),
        num("mcv", "MCV", "fL", 80, 100, { decimals: 0 }),
        num("mch", "MCH", "pg", 27, 33, { decimals: 1 }),
        num("mchc", "MCHC", "g/dL", 32, 36, { decimals: 1 }),
        num("rdw", "RDW", "%", 11.5, 14.5, { decimals: 1 }),
        num("wbc", "WBC count", "×10³/µL", 4.0, 11.0, { criticalLow: 2.0, criticalHigh: 30, decimals: 1 }),
        num("neut", "Neutrophils", "%", 40, 75, { decimals: 0 }),
        num("lymph", "Lymphocytes", "%", 20, 45, { decimals: 0 }),
        num("mono", "Monocytes", "%", 2, 10, { decimals: 0 }),
        num("eos", "Eosinophils", "%", 1, 6, { decimals: 0 }),
        num("baso", "Basophils", "%", 0, 1, { decimals: 0 }),
        num("plt", "Platelets", "×10³/µL", 150, 400, { criticalLow: 20, criticalHigh: 1000, decimals: 0 }),
    ], { specimen: "EDTA blood", aliases: ["full blood count", "fbc", "hemogram", "hb", "wbc", "platelets"] }),
    lab("esr", "ESR", "haematology", 60, [num("esr", "ESR", "mm/hr", 0, 20, { male: { high: 15 }, female: { high: 20 }, decimals: 0 })], { specimen: "EDTA blood" }),
    lab("peripheral_smear", "Peripheral blood smear", "haematology", 45, [qual("smear", "Morphology", "Normocytic normochromic; no abnormal cells")]),
    lab("reticulocyte_count", "Reticulocyte count", "haematology", 45, [num("retic", "Reticulocytes", "%", 0.5, 2.5, { decimals: 1 })]),
    lab("blood_group_crossmatch", "Blood group & cross-match", "haematology", 45, [qual("abo", "ABO / Rh", "Group determined")]),
    lab("hb_electrophoresis", "Haemoglobin electrophoresis", "haematology", 240, [qual("hbe", "Pattern", "HbA predominant; HbA2 < 3.5%")]),
    lab("sickle_screen", "Sickle cell screen", "haematology", 60, [qual("sickle", "Sickling", "Negative")]),
    lab("g6pd_assay", "G6PD assay", "haematology", 120, [num("g6pd", "G6PD", "U/g Hb", 7, 20, { decimals: 1 })]),
    lab("coombs_direct", "Direct Coombs test", "haematology", 60, [qual("dct", "DAT", "Negative")]),
    lab("coombs_indirect", "Indirect Coombs test", "haematology", 60, [qual("ict", "Antibody screen", "Negative")]),
    lab("ferritin", "Serum ferritin", "haematology", 90, [num("ferritin", "Ferritin", "ng/mL", 11, 336, { male: { low: 24, high: 336 }, female: { low: 11, high: 307 }, decimals: 0 })]),
    lab("iron_studies", "Iron studies", "haematology", 90, [
        num("iron", "Serum iron", "µg/dL", 60, 170, { decimals: 0 }),
        num("tibc", "TIBC", "µg/dL", 240, 450, { decimals: 0 }),
        num("tsat", "Transferrin saturation", "%", 20, 50, { decimals: 0 }),
    ]),
    lab("vitamin_b12", "Vitamin B12", "haematology", 120, [num("b12", "Vitamin B12", "pg/mL", 200, 900, { decimals: 0 })]),
    lab("folate", "Serum folate", "haematology", 120, [num("folate", "Folate", "ng/mL", 3, 17, { decimals: 1 })]),
    lab("bleeding_time", "Bleeding time", "haematology", 20, [num("bt", "Bleeding time", "min", 2, 7, { decimals: 0 })]),

    // ── Coagulation ────────────────────────────────────────────────────────
    lab("pt_inr", "PT / INR", "coagulation", 20, [
        num("pt", "Prothrombin time", "s", 11, 13.5, { decimals: 1 }),
        num("inr", "INR", "", 0.8, 1.2, { criticalHigh: 5.0, decimals: 1 }),
    ], { specimen: "Citrate blood", aliases: ["prothrombin", "coagulation screen"] }),
    lab("aptt", "aPTT", "coagulation", 20, [num("aptt", "aPTT", "s", 25, 35, { criticalHigh: 100, decimals: 0 })], { specimen: "Citrate blood", aliases: ["ptt", "coagulation screen"] }),
    lab("fibrinogen", "Fibrinogen", "coagulation", 30, [num("fibrinogen", "Fibrinogen", "mg/dL", 200, 400, { criticalLow: 100, decimals: 0 })]),
    lab("d_dimer", "D-dimer", "coagulation", 25, [num("d_dimer", "D-dimer", "mg/L FEU", undefined, 0.5, { decimals: 2 })], { aliases: ["pulmonary embolism screen", "dvt"] }),
    lab("anti_xa", "Anti-Xa level", "coagulation", 60, [num("antixa", "Anti-Xa", "IU/mL", 0, 0.1, { decimals: 2 })]),

    // ── Biochemistry ───────────────────────────────────────────────────────
    lab("bmp", "Basic metabolic panel (U&E + glucose)", "biochemistry", 20, [
        num("na", "Sodium", "mEq/L", 135, 145, { criticalLow: 120, criticalHigh: 160, decimals: 0 }),
        num("k", "Potassium", "mEq/L", 3.5, 5.0, { criticalLow: 2.8, criticalHigh: 6.5, decimals: 1 }),
        num("cl", "Chloride", "mEq/L", 98, 107, { decimals: 0 }),
        num("hco3", "Bicarbonate", "mEq/L", 22, 29, { criticalLow: 10, decimals: 0 }),
        num("bun", "Urea (BUN)", "mg/dL", 7, 20, { decimals: 0 }),
        num("creat", "Creatinine", "mg/dL", 0.6, 1.3, { male: { low: 0.74, high: 1.35 }, female: { low: 0.59, high: 1.04 }, criticalHigh: 5.0, decimals: 2 }),
        num("glucose", "Glucose (random)", "mg/dL", 70, 140, { criticalLow: 50, criticalHigh: 500, decimals: 0 }),
    ], { specimen: "Serum", aliases: ["u&e", "urea and electrolytes", "chem7", "renal profile", "electrolytes"] }),
    lab("electrolytes", "Serum electrolytes", "biochemistry", 15, [
        num("na", "Sodium", "mEq/L", 135, 145, { criticalLow: 120, criticalHigh: 160, decimals: 0 }),
        num("k", "Potassium", "mEq/L", 3.5, 5.0, { criticalLow: 2.8, criticalHigh: 6.5, decimals: 1 }),
        num("cl", "Chloride", "mEq/L", 98, 107, { decimals: 0 }),
        num("hco3", "Bicarbonate", "mEq/L", 22, 29, { criticalLow: 10, decimals: 0 }),
    ], { specimen: "Serum", aliases: ["sodium", "potassium"] }),
    lab("renal_function", "Renal function (urea, creatinine, eGFR)", "biochemistry", 20, [
        num("bun", "Urea (BUN)", "mg/dL", 7, 20, { decimals: 0 }),
        num("creat", "Creatinine", "mg/dL", 0.6, 1.3, { male: { low: 0.74, high: 1.35 }, female: { low: 0.59, high: 1.04 }, criticalHigh: 5.0, decimals: 2 }),
        num("egfr", "eGFR", "mL/min/1.73m²", 90, undefined, { decimals: 0 }),
    ], { aliases: ["kidney function", "rft", "kft"] }),
    lab("serum_calcium", "Serum calcium", "biochemistry", 30, [num("ca", "Calcium", "mg/dL", 8.6, 10.2, { criticalLow: 6.5, criticalHigh: 13, decimals: 1 })]),
    lab("serum_magnesium", "Serum magnesium", "biochemistry", 30, [num("mg", "Magnesium", "mg/dL", 1.7, 2.2, { criticalLow: 1.0, decimals: 1 })]),
    lab("serum_phosphate", "Serum phosphate", "biochemistry", 30, [num("phos", "Phosphate", "mg/dL", 2.5, 4.5, { decimals: 1 })]),
    lab("uric_acid", "Serum uric acid", "biochemistry", 45, [num("urate", "Uric acid", "mg/dL", 2.4, 7.0, { male: { low: 3.4, high: 7.0 }, female: { low: 2.4, high: 6.0 }, decimals: 1 })]),
    lab("lft", "Liver function tests", "biochemistry", 30, [
        num("alt", "ALT", "U/L", 7, 40, { decimals: 0 }),
        num("ast", "AST", "U/L", 10, 40, { decimals: 0 }),
        num("alp", "ALP", "U/L", 44, 147, { decimals: 0 }),
        num("ggt", "GGT", "U/L", 5, 61, { male: { low: 8, high: 61 }, female: { low: 5, high: 36 }, decimals: 0 }),
        num("tbil", "Total bilirubin", "mg/dL", 0.1, 1.2, { decimals: 1 }),
        num("dbil", "Direct bilirubin", "mg/dL", 0, 0.3, { decimals: 1 }),
        num("alb", "Albumin", "g/dL", 3.5, 5.0, { decimals: 1 }),
        num("tp", "Total protein", "g/dL", 6.0, 8.3, { decimals: 1 }),
    ], { specimen: "Serum", aliases: ["lfts", "liver panel"] }),
    lab("glucose_random", "Blood glucose (random)", "biochemistry", 5, [num("glucose", "Glucose (random)", "mg/dL", 70, 140, { criticalLow: 50, criticalHigh: 500, decimals: 0 })], { aliases: ["rbs", "capillary glucose", "sugar"] }),
    lab("glucose_fasting", "Fasting blood glucose", "biochemistry", 30, [num("glucose", "Glucose (fasting)", "mg/dL", 70, 99, { decimals: 0 })], { aliases: ["fbs"] }),
    lab("hba1c", "HbA1c", "biochemistry", 45, [num("hba1c", "HbA1c", "%", 4.0, 5.6, { decimals: 1 })], { aliases: ["glycated haemoglobin"] }),
    lab("lipid_profile", "Lipid profile", "biochemistry", 60, [
        num("tc", "Total cholesterol", "mg/dL", undefined, 200, { decimals: 0 }),
        num("ldl", "LDL cholesterol", "mg/dL", undefined, 100, { decimals: 0 }),
        num("hdl", "HDL cholesterol", "mg/dL", 40, undefined, { male: { low: 40 }, female: { low: 50 }, decimals: 0 }),
        num("tg", "Triglycerides", "mg/dL", undefined, 150, { decimals: 0 }),
    ], { specimen: "Fasting serum", aliases: ["cholesterol", "lipids"] }),
    lab("amylase", "Serum amylase", "biochemistry", 30, [num("amylase", "Amylase", "U/L", 30, 110, { decimals: 0 })]),
    lab("lipase", "Serum lipase", "biochemistry", 30, [num("lipase", "Lipase", "U/L", 10, 160, { decimals: 0 })]),
    lab("ldh", "Lactate dehydrogenase (LDH)", "biochemistry", 30, [num("ldh", "LDH", "U/L", 140, 280, { decimals: 0 })]),
    lab("ck_total", "Total creatine kinase (CK)", "biochemistry", 30, [num("ck", "CK", "U/L", 26, 308, { male: { low: 39, high: 308 }, female: { low: 26, high: 192 }, decimals: 0 })], { aliases: ["cpk", "rhabdomyolysis"] }),
    lab("crp", "C-reactive protein (CRP)", "biochemistry", 30, [num("crp", "CRP", "mg/L", undefined, 5, { decimals: 1 })]),
    lab("hs_crp", "High-sensitivity CRP", "biochemistry", 60, [num("hscrp", "hs-CRP", "mg/L", undefined, 3, { decimals: 1 })]),
    lab("procalcitonin", "Procalcitonin", "biochemistry", 45, [num("pct", "Procalcitonin", "ng/mL", undefined, 0.5, { decimals: 2 })]),
    lab("lactate", "Serum lactate", "biochemistry", 5, [num("lactate", "Lactate", "mmol/L", 0.5, 2.0, { criticalHigh: 4.0, decimals: 1 })], { specimen: "Heparinised blood", aliases: ["lactic acid"] }),
    lab("ammonia", "Blood ammonia", "biochemistry", 60, [num("nh3", "Ammonia", "µg/dL", 15, 45, { decimals: 0 })]),
    lab("serum_osmolality", "Serum osmolality", "biochemistry", 45, [num("osm", "Osmolality", "mOsm/kg", 275, 295, { decimals: 0 })]),
    lab("ketones_bhb", "Beta-hydroxybutyrate", "biochemistry", 10, [num("bhb", "β-Hydroxybutyrate", "mmol/L", undefined, 0.6, { criticalHigh: 3.0, decimals: 1 })], { aliases: ["ketones", "dka"] }),
    lab("vitamin_d", "Vitamin D (25-OH)", "biochemistry", 180, [num("vitd", "25-OH Vitamin D", "ng/mL", 30, 100, { decimals: 0 })]),
    lab("pth", "Parathyroid hormone (PTH)", "biochemistry", 180, [num("pth", "PTH", "pg/mL", 15, 65, { decimals: 0 })]),
    lab("protein_electrophoresis", "Serum protein electrophoresis", "biochemistry", 240, [qual("spep", "Pattern", "No monoclonal band")]),
    lab("immunoglobulins", "Immunoglobulins (IgG, IgA, IgM)", "biochemistry", 240, [
        num("igg", "IgG", "mg/dL", 700, 1600, { decimals: 0 }),
        num("iga", "IgA", "mg/dL", 70, 400, { decimals: 0 }),
        num("igm", "IgM", "mg/dL", 40, 230, { decimals: 0 }),
    ]),
    lab("psa", "Prostate-specific antigen (PSA)", "biochemistry", 120, [num("psa", "PSA", "ng/mL", undefined, 4.0, { decimals: 1 })]),
    lab("afp", "Alpha-fetoprotein (AFP)", "biochemistry", 180, [num("afp", "AFP", "ng/mL", undefined, 10, { decimals: 1 })]),
    lab("cea", "Carcinoembryonic antigen (CEA)", "biochemistry", 180, [num("cea", "CEA", "ng/mL", undefined, 3.0, { decimals: 1 })]),
    lab("ca_125", "CA-125", "biochemistry", 180, [num("ca125", "CA-125", "U/mL", undefined, 35, { decimals: 0 })]),
    lab("ca_19_9", "CA 19-9", "biochemistry", 180, [num("ca199", "CA 19-9", "U/mL", undefined, 37, { decimals: 0 })]),
    lab("ceruloplasmin", "Serum ceruloplasmin", "biochemistry", 240, [num("cp", "Ceruloplasmin", "mg/dL", 20, 60, { decimals: 0 })]),

    // ── Endocrine ──────────────────────────────────────────────────────────
    lab("tsh", "TSH", "endocrine", 60, [num("tsh", "TSH", "µIU/mL", 0.4, 4.0, { decimals: 2 })], { aliases: ["thyroid"] }),
    lab("ft4", "Free T4", "endocrine", 60, [num("ft4", "Free T4", "ng/dL", 0.8, 1.8, { decimals: 1 })], { aliases: ["thyroid"] }),
    lab("ft3", "Free T3", "endocrine", 60, [num("ft3", "Free T3", "pg/mL", 2.3, 4.2, { decimals: 1 })], { aliases: ["thyroid"] }),
    lab("cortisol_am", "Serum cortisol (morning)", "endocrine", 120, [num("cortisol", "Cortisol", "µg/dL", 6, 23, { decimals: 1 })]),
    lab("prolactin", "Prolactin", "endocrine", 120, [num("prl", "Prolactin", "ng/mL", 2, 18, { decimals: 1 })]),
    lab("testosterone", "Total testosterone", "endocrine", 180, [num("testo", "Testosterone", "ng/dL", 300, 1000, { male: { low: 300, high: 1000 }, female: { low: 15, high: 70 }, decimals: 0 })]),
    lab("hcg_serum", "Serum β-hCG", "endocrine", 60, [num("bhcg", "β-hCG", "mIU/mL", undefined, 5, { decimals: 0 })], { aliases: ["pregnancy test"] }),

    // ── Blood gas ──────────────────────────────────────────────────────────
    lab("abg", "Arterial blood gas (ABG)", "blood_gas", 5, [
        num("ph", "pH", "", 7.35, 7.45, { criticalLow: 7.2, criticalHigh: 7.6, decimals: 2 }),
        num("pco2", "pCO₂", "mmHg", 35, 45, { decimals: 0 }),
        num("po2", "pO₂", "mmHg", 80, 100, { criticalLow: 50, decimals: 0 }),
        num("hco3", "HCO₃⁻", "mEq/L", 22, 26, { decimals: 0 }),
        num("be", "Base excess", "mEq/L", -2, 2, { decimals: 0 }),
        num("sao2", "SaO₂", "%", 95, 100, { decimals: 0 }),
    ], { specimen: "Arterial blood", aliases: ["blood gas", "gases"] }),
    lab("vbg", "Venous blood gas (VBG)", "blood_gas", 5, [
        num("ph", "pH", "", 7.31, 7.41, { decimals: 2 }),
        num("pco2", "pCO₂", "mmHg", 41, 51, { decimals: 0 }),
        num("hco3", "HCO₃⁻", "mEq/L", 22, 26, { decimals: 0 }),
    ], { specimen: "Venous blood" }),

    // ── Urine ──────────────────────────────────────────────────────────────
    lab("urinalysis", "Urinalysis (dipstick)", "urine", 10, [
        num("ph", "pH", "", 4.5, 8.0, { decimals: 1 }),
        num("sg", "Specific gravity", "", 1.005, 1.030, { decimals: 3 }),
        qual("protein", "Protein", "Negative"),
        qual("glucose", "Glucose", "Negative"),
        qual("ketones", "Ketones", "Negative"),
        qual("blood", "Blood", "Negative"),
        qual("leuk", "Leukocytes", "Negative"),
        qual("nitrite", "Nitrite", "Negative"),
    ], { aliases: ["urine routine", "dipstick", "urine r/e"] }),
    lab("urine_microscopy", "Urine microscopy", "urine", 45, [qual("micro", "Sediment", "No casts, cells or crystals")]),
    lab("urine_culture", "Urine culture", "urine", 1440, [qual("culture", "Growth", "No growth")]),
    lab("urine_pregnancy_test", "Urine pregnancy test", "urine", 10, [qual("upt", "hCG", "Negative")]),
    lab("urine_protein_24h", "24-hour urine protein", "urine", 1440, [num("uprot", "Protein", "mg/24h", undefined, 150, { decimals: 0 })]),
    lab("urine_acr", "Urine albumin:creatinine ratio", "urine", 60, [num("acr", "ACR", "mg/g", undefined, 30, { decimals: 0 })]),
    lab("urine_electrolytes", "Urine electrolytes", "urine", 60, [num("una", "Urine sodium", "mEq/L", 40, 220, { decimals: 0 })]),
    lab("urine_drug_screen", "Urine drug screen", "urine", 30, [qual("uds", "Screen", "Negative")]),

    // ── Microbiology ───────────────────────────────────────────────────────
    lab("blood_culture", "Blood cultures ×2", "microbiology", 1440, [qual("bcx", "Growth", "No growth")]),
    lab("sputum_culture", "Sputum culture", "microbiology", 1440, [qual("scx", "Growth", "Normal flora")]),
    lab("throat_swab", "Throat swab culture", "microbiology", 1440, [qual("tsx", "Growth", "Normal flora")]),
    lab("wound_swab_culture", "Wound swab culture", "microbiology", 1440, [qual("wsx", "Growth", "No growth")]),
    lab("stool_culture", "Stool culture", "microbiology", 1440, [qual("stx", "Growth", "No pathogens")]),
    lab("stool_ova_parasites", "Stool ova & parasites", "microbiology", 120, [qual("ova", "Microscopy", "None seen")]),
    lab("stool_occult_blood", "Stool occult blood", "microbiology", 30, [qual("fob", "FOB", "Negative")]),
    lab("c_difficile_toxin", "C. difficile toxin", "microbiology", 120, [qual("cdt", "Toxin", "Negative")]),
    lab("malaria_smear", "Malaria smear (thick & thin)", "microbiology", 30, [qual("mp", "Parasites", "Not seen")], { aliases: ["mp", "blood film malaria"] }),
    lab("malaria_rdt", "Malaria rapid antigen test", "microbiology", 15, [qual("rdt", "Antigen", "Negative")]),
    lab("tb_genexpert", "TB GeneXpert (CBNAAT)", "microbiology", 120, [qual("mtb", "MTB", "Not detected")]),
    lab("afb_smear_sputum", "Sputum AFB smear", "microbiology", 60, [qual("afb", "AFB", "Not seen")]),
    lab("covid19_pcr", "SARS-CoV-2 PCR", "microbiology", 120, [qual("cov", "Result", "Not detected")]),
    lab("influenza_pcr", "Influenza A/B PCR", "microbiology", 90, [qual("flu", "Result", "Not detected")]),
    lab("gram_stain", "Gram stain (specimen)", "microbiology", 30, [qual("gram", "Organisms", "None seen")]),

    // ── Serology ───────────────────────────────────────────────────────────
    lab("hiv_test", "HIV 1/2 Ag/Ab", "serology", 30, [qual("hiv", "Result", "Non-reactive")]),
    lab("hbsag", "HBsAg", "serology", 30, [qual("hbsag", "Result", "Non-reactive")]),
    lab("anti_hcv", "Anti-HCV antibody", "serology", 30, [qual("hcv", "Result", "Non-reactive")]),
    lab("vdrl_rpr", "VDRL / RPR", "serology", 45, [qual("vdrl", "Result", "Non-reactive")]),
    lab("dengue_ns1", "Dengue NS1 antigen", "serology", 20, [qual("ns1", "Result", "Negative")]),
    lab("dengue_igm", "Dengue IgM / IgG", "serology", 60, [qual("dgm", "Result", "Negative")]),
    lab("widal_test", "Widal test", "serology", 60, [qual("widal", "Titre", "Not significant")]),
    lab("ana", "Antinuclear antibody (ANA)", "serology", 240, [qual("ana", "Result", "Negative")]),
    lab("rheumatoid_factor", "Rheumatoid factor", "serology", 120, [num("rf", "RF", "IU/mL", undefined, 14, { decimals: 0 })]),
    lab("anti_ccp", "Anti-CCP antibody", "serology", 240, [num("ccp", "Anti-CCP", "U/mL", undefined, 20, { decimals: 0 })]),
    lab("aso_titre", "ASO titre", "serology", 120, [num("aso", "ASO", "IU/mL", undefined, 200, { decimals: 0 })]),
    lab("anti_dsdna", "Anti-dsDNA", "serology", 240, [num("dsdna", "Anti-dsDNA", "IU/mL", undefined, 30, { decimals: 0 })]),
    lab("complement_c3_c4", "Complement C3 / C4", "serology", 240, [
        num("c3", "C3", "mg/dL", 90, 180, { decimals: 0 }),
        num("c4", "C4", "mg/dL", 10, 40, { decimals: 0 }),
    ]),
    lab("anca", "ANCA", "serology", 240, [qual("anca", "Result", "Negative")]),
    lab("celiac_ttg", "Anti-tTG IgA (coeliac)", "serology", 240, [num("ttg", "Anti-tTG IgA", "U/mL", undefined, 10, { decimals: 0 })]),
    lab("leptospira_igm", "Leptospira IgM", "serology", 180, [qual("lepto", "Result", "Negative")]),
    lab("scrub_typhus_igm", "Scrub typhus IgM", "serology", 180, [qual("scrub", "Result", "Negative")]),
    lab("mantoux_test", "Mantoux (tuberculin) test", "serology", 2880, [num("mx", "Induration", "mm", 0, 9, { decimals: 0 })]),

    // ── Toxicology ─────────────────────────────────────────────────────────
    lab("paracetamol_level", "Serum paracetamol level", "toxicology", 45, [num("apap", "Paracetamol", "µg/mL", undefined, 10, { decimals: 0 })]),
    lab("salicylate_level", "Serum salicylate level", "toxicology", 45, [num("sal", "Salicylate", "mg/dL", undefined, 3, { decimals: 1 })]),
    lab("serum_alcohol", "Serum ethanol", "toxicology", 30, [num("etoh", "Ethanol", "mg/dL", undefined, 10, { decimals: 0 })]),
    lab("digoxin_level", "Serum digoxin level", "toxicology", 60, [num("dig", "Digoxin", "ng/mL", 0.8, 2.0, { decimals: 1 })]),
    lab("carboxyhaemoglobin", "Carboxyhaemoglobin (co-oximetry)", "toxicology", 10, [num("cohb", "COHb", "%", 0, 3, { decimals: 1 })]),

    // ── Imaging ────────────────────────────────────────────────────────────
    study("cxr_pa", "Chest X-ray (PA)", "imaging", "imaging", 20, { aliases: ["chest xray", "cxr"] }),
    study("cxr_portable", "Portable chest X-ray (AP)", "imaging", "imaging", 10, { aliases: ["chest xray", "cxr", "bedside"] }),
    study("xray_chest_lateral", "Chest X-ray (lateral)", "imaging", "imaging", 20),
    study("xray_abdomen", "Abdominal X-ray", "imaging", "imaging", 20, { aliases: ["kub", "plain abdomen"] }),
    study("xray_spine_lumbar", "X-ray lumbar spine", "imaging", "imaging", 20),
    study("xray_cervical_spine", "X-ray cervical spine", "imaging", "imaging", 20),
    study("xray_pelvis", "X-ray pelvis", "imaging", "imaging", 20),
    study("xray_knee", "X-ray knee", "imaging", "imaging", 20),
    study("xray_hand", "X-ray hand / wrist", "imaging", "imaging", 20),
    study("xray_ankle", "X-ray ankle / foot", "imaging", "imaging", 20),
    study("xray_skull", "X-ray skull", "imaging", "imaging", 20),
    study("ct_head_noncontrast", "CT head (non-contrast)", "imaging", "imaging", 25, { aliases: ["ct brain"] }),
    study("ct_chest", "CT chest", "imaging", "imaging", 30),
    study("ctpa", "CT pulmonary angiogram (CTPA)", "imaging", "imaging", 30, { aliases: ["pulmonary embolism", "pe"] }),
    study("ct_aortogram", "CT aortic angiogram", "imaging", "imaging", 30, { aliases: ["aortic dissection", "ct angiography aorta"] }),
    study("ct_abdomen_pelvis", "CT abdomen & pelvis", "imaging", "imaging", 35),
    study("ct_kub", "CT KUB (non-contrast)", "imaging", "imaging", 30, { aliases: ["renal colic", "stones"] }),
    study("hrct_chest", "HRCT chest", "imaging", "imaging", 45),
    study("ct_neck", "CT neck", "imaging", "imaging", 30),
    study("mri_brain", "MRI brain", "imaging", "imaging", 90),
    study("mri_spine", "MRI spine", "imaging", "imaging", 90),
    study("mri_knee", "MRI knee", "imaging", "imaging", 90),
    study("mri_pelvis", "MRI pelvis", "imaging", "imaging", 90),
    study("usg_abdomen", "Ultrasound abdomen", "imaging", "imaging", 25),
    study("usg_kub", "Ultrasound KUB", "imaging", "imaging", 25),
    study("usg_pelvis", "Ultrasound pelvis", "imaging", "imaging", 25),
    study("usg_neck_thyroid", "Ultrasound neck / thyroid", "imaging", "imaging", 30),
    study("usg_breast", "Ultrasound breast", "imaging", "imaging", 30),
    study("fast_scan", "FAST scan", "imaging", "imaging", 10, { aliases: ["trauma ultrasound"] }),
    study("doppler_leg_veins", "Doppler ultrasound leg veins", "imaging", "imaging", 30, { aliases: ["dvt"] }),
    study("carotid_doppler", "Carotid Doppler", "imaging", "imaging", 30),
    study("doppler_renal", "Renal Doppler ultrasound", "imaging", "imaging", 30),
    study("vq_scan", "V/Q scan", "imaging", "imaging", 120, { aliases: ["pulmonary embolism"] }),
    study("pet_ct", "PET-CT", "imaging", "imaging", 240),
    study("dexa_scan", "DEXA bone density", "imaging", "imaging", 60),
    study("mammography", "Mammography", "imaging", "imaging", 45),
    study("barium_swallow", "Barium swallow", "imaging", "imaging", 60),

    // ── Special investigations & procedures ───────────────────────────────
    study("spirometry", "Spirometry (PFT)", "special", "procedure", 45, { aliases: ["pulmonary function test"] }),
    study("peak_flow", "Peak expiratory flow", "special", "bedside", 5),
    study("eeg", "EEG", "special", "procedure", 120),
    study("nerve_conduction_emg", "Nerve conduction / EMG", "special", "procedure", 120),
    study("lumbar_puncture_csf", "Lumbar puncture & CSF analysis", "special", "procedure", 90),
    study("pleural_fluid_analysis", "Pleural fluid analysis", "special", "procedure", 90),
    study("ascitic_fluid_analysis", "Ascitic fluid analysis", "special", "procedure", 90),
    study("bone_marrow_biopsy", "Bone marrow aspirate & biopsy", "special", "procedure", 1440),
    study("upper_gi_endoscopy", "Upper GI endoscopy", "special", "procedure", 90),
    study("colonoscopy", "Colonoscopy", "special", "procedure", 120),
    study("bronchoscopy", "Bronchoscopy", "special", "procedure", 120),
    study("fnac", "Fine-needle aspiration cytology (FNAC)", "special", "procedure", 240),
    study("biopsy_histopathology", "Biopsy for histopathology", "special", "procedure", 2880),
    study("audiometry", "Pure-tone audiometry", "special", "procedure", 45),
    study("visual_fields", "Visual field testing", "special", "procedure", 45),
    study("polysomnography", "Polysomnography (sleep study)", "special", "procedure", 720),
];

// ── Lookup ──────────────────────────────────────────────────────────────────

const BY_ID: ReadonlyMap<string, CatalogTest> = new Map(CLINICAL_CATALOG.map((t) => [t.id, t]));

export const CATALOG_TEST_IDS: readonly string[] = CLINICAL_CATALOG.map((t) => t.id);

export function getCatalogTest(id: string): CatalogTest | undefined {
    return BY_ID.get(id);
}

/** Case-insensitive search over name, id and aliases; optionally restricted to a category. */
export function searchCatalog(query: string, category?: TestCategory | "all"): CatalogTest[] {
    const q = query.trim().toLowerCase();
    return CLINICAL_CATALOG.filter((t) => {
        if (category && category !== "all" && t.category !== category) return false;
        if (!q) return true;
        return (
            t.name.toLowerCase().includes(q) ||
            t.id.replace(/_/g, " ").includes(q) ||
            (t.aliases ?? []).some((a) => a.toLowerCase().includes(q))
        );
    });
}

/** Which assist unlocks the expert read of this test. Labs use the explain-abnormal assist. */
export function assistTypeForTest(test: Pick<CatalogTest, "kind">): AssistType {
    if (test.kind === "ecg") return "ecg_interpretation_hint";
    if (test.kind === "imaging") return "radiology_impression";
    return "explain_abnormal";
}

// ── Ranges & status ─────────────────────────────────────────────────────────

/** The [low, high] interval for a parameter, honouring sex-specific overrides. */
export function resolveRange(param: CatalogParameter, sex: Sex = "male"): { low?: number; high?: number } {
    const override = param[sex];
    return {
        low: override && "low" in override ? override.low : param.low,
        high: override && "high" in override ? override.high : param.high,
    };
}

export function formatReferenceRange(param: CatalogParameter, sex: Sex = "male"): string {
    if (param.normalText !== undefined) return param.normalText;
    const { low, high } = resolveRange(param, sex);
    if (low !== undefined && high !== undefined) return `${low}–${high}`;
    if (high !== undefined) return `< ${high}`;
    if (low !== undefined) return `> ${low}`;
    return "—";
}

/** Normal / low / high / critical for a numeric result; qualitative results compare to the normal finding. */
export function deriveStatus(param: CatalogParameter, value: number | string, sex: Sex = "male"): ValueStatus {
    if (typeof value === "string" || param.normalText !== undefined) {
        const text = String(value).trim().toLowerCase();
        return param.normalText !== undefined && text === param.normalText.toLowerCase() ? "normal" : "high";
    }
    if (param.criticalLow !== undefined && value <= param.criticalLow) return "critical";
    if (param.criticalHigh !== undefined && value >= param.criticalHigh) return "critical";
    const { low, high } = resolveRange(param, sex);
    if (low !== undefined && value < low) return "low";
    if (high !== undefined && value > high) return "high";
    return "normal";
}

/** A value comfortably inside the normal range — what an unremarkable patient would return. */
export function defaultNormalValue(param: CatalogParameter, sex: Sex = "male"): number | string {
    if (param.normalText !== undefined) return param.normalText;
    const { low, high } = resolveRange(param, sex);
    let mid: number;
    if (low !== undefined && high !== undefined) mid = (low + high) / 2;
    else if (high !== undefined) mid = high * 0.4;
    else if (low !== undefined) mid = low * 1.4;
    else mid = 0;
    const decimals = param.decimals ?? (Math.abs(mid) >= 100 ? 0 : Math.abs(mid) >= 10 ? 1 : 2);
    return Number(mid.toFixed(decimals));
}

export function formatValue(value: number | string, param: CatalogParameter): string {
    if (typeof value === "string") return value;
    return param.decimals !== undefined ? value.toFixed(param.decimals) : String(value);
}
