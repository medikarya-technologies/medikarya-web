// The small badge for each kind of contributor, in the site's own look (one brand blue on a pale tile, line drawings
// with one solid accent): a case sheet and pen for writers, a report with a check seal for reviewers, a medal for
// the Clinical Advisory Board, a sprout for the early contributors. Used on the home page's write-or-review section,
// /contribute and /contributors. People themselves get a plain profile picture (EmptyAvatar), not a badge.

import { cn } from "@/lib/utils"

export type ContributorRole = "writer" | "reviewer" | "advisor" | "early"

const LINE = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const

function Writer() {
    return (
        <>
            <rect x="8.5" y="7" width="17" height="23" rx="2.6" {...LINE} fill="currentColor" fillOpacity=".08" />
            <path d="M12.5 13h9M12.5 17h9M12.5 21h5" {...LINE} strokeOpacity=".55" />
            <g transform="rotate(38 27 22)">
                <rect x="25" y="9" width="4.6" height="16" rx="1.4" {...LINE} fill="var(--mark-tile, #fff)" />
                <path d="M25 25h4.6l-2.3 4.8z" fill="currentColor" />
            </g>
        </>
    )
}

function Reviewer() {
    return (
        <>
            <rect x="8.5" y="6.5" width="17" height="23" rx="2.6" {...LINE} fill="currentColor" fillOpacity=".08" />
            <path d="M12.5 12.5h9M12.5 16.5h9M12.5 20.5h5" {...LINE} strokeOpacity=".55" />
            <circle cx="27" cy="27" r="6.6" fill="currentColor" stroke="var(--mark-tile, #fff)" strokeWidth="2" />
            <path d="M24.2 27.1l1.9 1.9 3.7-3.9" fill="none" stroke="var(--mark-tile, #fff)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </>
    )
}

function Advisor() {
    return (
        <>
            <path d="M15.2 22.5L12 32l3.9-1.3 2.4 3.1 2-6.6" {...LINE} />
            <path d="M24.8 22.5L28 32l-3.9-1.3-2.4 3.1-2-6.6" {...LINE} />
            <circle cx="20" cy="16.5" r="8.6" {...LINE} fill="currentColor" fillOpacity=".08" />
            <path d="M20 11.6l1.55 3.15 3.5.5-2.5 2.45.6 3.45L20 19.5l-3.15 1.65.6-3.45-2.5-2.45 3.5-.5z" fill="currentColor" />
        </>
    )
}

function Early() {
    return (
        <>
            <path d="M12 30.5h16" {...LINE} strokeOpacity=".55" />
            <path d="M20 30.5V19" {...LINE} />
            <path d="M20 22.5c-5.4 0-8.2-3.5-8.2-8.2 4.7 0 8.2 2.9 8.2 8.2z" {...LINE} fill="currentColor" fillOpacity=".12" />
            <path d="M20 19.5c0-5.3 3.4-8.4 8.4-8.4 0 4.8-3.2 8.4-8.4 8.4z" fill="currentColor" />
        </>
    )
}

const ART: Record<ContributorRole, () => React.ReactElement> = { writer: Writer, reviewer: Reviewer, advisor: Advisor, early: Early }

export function RoleMark({ role, size = "md", tone = "light", className }: { role: ContributorRole; size?: "sm" | "md" | "lg"; tone?: "light" | "dark"; className?: string }) {
    const Art = ART[role]
    return (
        <span
            aria-hidden
            className={cn(
                "inline-flex shrink-0 items-center justify-center border",
                tone === "light" ? "border-brand-100 bg-brand-50 text-brand-600 [--mark-tile:var(--color-brand-50,#eff6ff)]" : "border-white/15 bg-white/10 text-white [--mark-tile:#1e293b]",
                size === "sm" && "h-8 w-8 rounded-lg",
                size === "md" && "h-11 w-11 rounded-xl",
                size === "lg" && "h-12 w-12 rounded-xl",
                className
            )}
        >
            <svg viewBox="0 0 40 40" className="h-[80%] w-[80%]">
                <Art />
            </svg>
        </span>
    )
}

/** A plain, empty profile picture for a person. */
export function EmptyAvatar({ className }: { className?: string }) {
    return (
        <span aria-hidden className={cn("inline-flex h-12 w-12 shrink-0 items-end justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200", className)}>
            <svg viewBox="0 0 40 40" className="h-[88%] w-[88%] text-slate-300">
                <circle cx="20" cy="15" r="7" fill="currentColor" />
                <path d="M6 40c0-8.3 6.3-14 14-14s14 5.7 14 14z" fill="currentColor" />
            </svg>
        </span>
    )
}
