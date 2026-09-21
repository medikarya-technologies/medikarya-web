// =========================
// lib/library/library-url.ts
// =========================
// The library's filters and order, as the address bar keeps them, so the Back button returns to the same list
// and a link to a filtered list can be sent to someone. Short, readable names, and only what differs from the
// defaults: an unfiltered library is just /dashboard/cases.
//
//   ?q=chest+pain&specialty=Cardiology&level=2&status=new&saved=1&sort=shortest
//
// Reading is forgiving (a stale or hand-edited link never breaks the page: an unknown value is ignored) and
// writing is exact. Pure: no React and no `URLSearchParams`, so it runs anywhere.

import { NO_FILTERS, SORT_LABEL, type DifficultyLevel, type Filters, type SortKey, type StatusFilter } from "./case-library";

export interface LibraryView {
    filters: Filters;
    sort: SortKey;
}

export const DEFAULT_VIEW: LibraryView = { filters: NO_FILTERS, sort: "recommended" };

/** Anything with `get`, so a real `URLSearchParams` and Next's read-only one both fit. */
export interface ParamsLike {
    get(name: string): string | null;
}

const MAX_QUERY = 200;
const SORTS = Object.keys(SORT_LABEL) as SortKey[];

/**
 * `specialties` is the list the library actually has: a link to a specialty that is not in it (renamed, removed)
 * falls back to "all" instead of showing an empty list. Pass nothing while the list is still loading.
 */
export function viewFromParams(params: ParamsLike, specialties: readonly string[] = []): LibraryView {
    const query = (params.get("q") ?? "").slice(0, MAX_QUERY);

    const wanted = params.get("specialty");
    const specialty = wanted && (specialties.length === 0 || specialties.includes(wanted)) ? wanted : "all";

    const level = Number(params.get("level"));
    const difficulty: 0 | DifficultyLevel = level === 1 || level === 2 || level === 3 ? level : 0;

    const s = params.get("status");
    const status: StatusFilter = s === "new" || s === "attempted" ? s : "all";

    const sort = SORTS.find((key) => key === params.get("sort")) ?? "recommended";

    const filters: Filters = { query, specialty, difficulty, status };
    if (params.get("saved") === "1") filters.saved = true;
    return { filters, sort };
}

const OWN = new Set(["q", "specialty", "level", "status", "saved", "sort"]);

const decoded = (text: string): string => {
    try {
        return decodeURIComponent(text);
    } catch {
        return text;
    }
};

/**
 * The address's query with the library's own parts replaced by `ours` and everything else left alone (the dev
 * preview pages carry ?empty=1 and ?name=, and those must survive a change of filter).
 */
export function mergeQuery(existing: string, ours: string): string {
    const kept = existing
        .replace(/^\?/, "")
        .split("&")
        .filter((pair) => pair && !OWN.has(decoded(pair.split("=")[0])));
    return [...kept, ...(ours ? [ours] : [])].join("&");
}

/** The query string for a view, without the "?" and empty when everything is at its default. */
export function queryFromView(view: LibraryView): string {
    const { filters: f, sort } = view;
    const parts: string[] = [];
    const add = (name: string, value: string) => parts.push(`${name}=${encodeURIComponent(value)}`);
    if (f.query.trim()) add("q", f.query.trim().slice(0, MAX_QUERY));
    if (f.specialty !== "all") add("specialty", f.specialty);
    if (f.difficulty !== 0) add("level", String(f.difficulty));
    if (f.status !== "all") add("status", f.status);
    if (f.saved) add("saved", "1");
    if (sort !== "recommended") add("sort", sort);
    return parts.join("&");
}

/** The library's address for a view: /dashboard/cases, with the query only when something differs from the defaults. */
export function libraryHref(view: LibraryView = DEFAULT_VIEW): string {
    const query = queryFromView(view);
    return query ? `/dashboard/cases?${query}` : "/dashboard/cases";
}

/** The library filtered to one specialty. */
export function specialtyHref(specialty: string): string {
    return libraryHref({ filters: { ...NO_FILTERS, specialty }, sort: "recommended" });
}
