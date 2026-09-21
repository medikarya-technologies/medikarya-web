// "2 days ago", "yesterday": how long since something. Kept apart from case-library.ts (which re-exports it) so a
// screen that only needs this, like the briefing card, does not carry the whole library logic with it.
//
// Pure: no React, no I/O, no `@/` imports.

/** "2 days ago", "yesterday", "3 weeks ago": how long since an attempt. `now` is a parameter so it can be tested. */
export function relativeDay(iso: string | undefined, now: number = Date.now()): string {
    const t = Date.parse(iso ?? "");
    if (Number.isNaN(t)) return "";
    const days = Math.floor((now - t) / 86_400_000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
}
