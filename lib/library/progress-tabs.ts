// =========================
// lib/library/progress-tabs.ts
// =========================
// The Progress page is three tabs, each one screen: the numbers (Overview), which parts of a case cost marks and how
// each specialty is going (Skills), and what was done (Activity). The address remembers which is open
// (/dashboard/progress?tab=skills) so a link lands on it and a reload keeps it; the first tab is the bare address.
//
// Reading is forgiving (an unknown value is the first tab, never an error) and writing keeps whatever else is in the
// address (the dev preview pages carry ?empty=1). Pure: no React and no `URLSearchParams`.

export const PROGRESS_TABS = ["overview", "skills", "activity"] as const;

export type ProgressTab = (typeof PROGRESS_TABS)[number];

export const DEFAULT_PROGRESS_TAB: ProgressTab = "overview";

export const PROGRESS_TAB_LABEL: Record<ProgressTab, string> = { overview: "Overview", skills: "Skills", activity: "Activity" };

/** The tab a `?tab=` value names. Next hands a repeated parameter over as a list: the first one counts. */
export function parseProgressTab(value: string | string[] | null | undefined): ProgressTab {
    const wanted = Array.isArray(value) ? value[0] : value;
    return PROGRESS_TABS.find((tab) => tab === wanted) ?? DEFAULT_PROGRESS_TAB;
}

const decoded = (text: string): string => {
    try {
        return decodeURIComponent(text);
    } catch {
        return text;
    }
};

/** The address's query (with or without the "?") set to `tab`: no `tab` part for the first tab, everything else kept. */
export function queryWithTab(existing: string, tab: ProgressTab): string {
    const kept = existing
        .replace(/^\?/, "")
        .split("&")
        .filter((pair) => pair && decoded(pair.split("=")[0]) !== "tab");
    return [...kept, ...(tab === DEFAULT_PROGRESS_TAB ? [] : [`tab=${tab}`])].join("&");
}
