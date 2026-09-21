// =========================
// lib/theme.ts
// =========================
// Light and dark for the app (the dashboard and the encounter), and only there: the marketing pages are drawn for
// light and have no dark version, so they stay light whatever the student chose. The choice is one of three, kept
// in the browser; "system" follows the device. Light is the default: dark is something you switch on.
//
// `themeInitScript` is the same rule as `wantsDark`, written as a string for <head>, so the right theme is on the
// page before it is first painted (no flash of white for someone who chose dark). A test runs the script against
// the function to keep the two the same.
//
// Pure: no React, and no browser globals touched at import time.

export type ThemePreference = "light" | "dark" | "system";

export const THEME_KEY = "medikarya-theme";

/** The parts of the site that have a dark theme. */
export const THEMED_PATH = /^\/(dashboard|try|sim-preview)(\/|$)/;

export const isThemedPath = (pathname: string): boolean => THEMED_PATH.test(pathname);

/** Anything that is not a known choice is the default, light. */
export function parsePreference(raw: string | null | undefined): ThemePreference {
    return raw === "dark" || raw === "system" ? raw : "light";
}

export function wantsDark(preference: ThemePreference, systemIsDark: boolean, pathname: string): boolean {
    return isThemedPath(pathname) && (preference === "dark" || (preference === "system" && systemIsDark));
}

export const themeInitScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d&&${THEMED_PATH.toString()}.test(location.pathname))}catch(e){}})()`;
