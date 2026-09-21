import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isThemedPath, parsePreference, themeInitScript, THEME_KEY, wantsDark, type ThemePreference } from "../theme";

describe("theme: which pages have a dark version", () => {
    it("is the app, not the marketing site", () => {
        for (const path of ["/dashboard", "/dashboard/cases", "/dashboard/cases/viral-gastroenteritis", "/dashboard/profile", "/dashboard/progress", "/try", "/try/", "/sim-preview", "/sim-preview/library", "/sim-preview/progress"]) {
            assert.equal(isThemedPath(path), true, path);
        }
        for (const path of ["/", "/blog", "/blog/some-post", "/about", "/login", "/signup", "/dashboards", "/tryout", "/sim-previews", "/api/cases"]) {
            assert.equal(isThemedPath(path), false, path);
        }
    });
});

describe("theme: the choice", () => {
    it("is light unless dark or system was chosen", () => {
        assert.equal(parsePreference("dark"), "dark");
        assert.equal(parsePreference("system"), "system");
        assert.equal(parsePreference("light"), "light");
        for (const other of [null, undefined, "", "DARK", "auto", "1"]) assert.equal(parsePreference(other), "light");
    });

    it("is dark only in the app, and only when asked for", () => {
        assert.equal(wantsDark("dark", false, "/dashboard"), true);
        assert.equal(wantsDark("dark", false, "/"), false);
        assert.equal(wantsDark("light", true, "/dashboard"), false);
        assert.equal(wantsDark("system", true, "/dashboard/cases"), true);
        assert.equal(wantsDark("system", false, "/dashboard/cases"), false);
        assert.equal(wantsDark("system", true, "/blog"), false);
    });
});

describe("theme: the script that runs before the first paint", () => {
    /** Runs the head script against a pretend browser and says whether it turned dark on. */
    function runScript(stored: string | null, systemIsDark: boolean, pathname: string, storageThrows = false): boolean | "untouched" {
        let result: boolean | "untouched" = "untouched";
        const localStorage = {
            getItem(key: string) {
                if (storageThrows) throw new Error("blocked");
                return key === THEME_KEY ? stored : null;
            },
        };
        const matchMedia = () => ({ matches: systemIsDark });
        const location = { pathname };
        const document = {
            documentElement: {
                classList: {
                    toggle(name: string, force: boolean) {
                        assert.equal(name, "dark");
                        result = force;
                    },
                },
            },
        };
        new Function("localStorage", "matchMedia", "location", "document", themeInitScript)(localStorage, matchMedia, location, document);
        return result;
    }

    it("agrees with wantsDark for every choice, device setting and page", () => {
        const stored: Array<string | null> = [null, "light", "dark", "system", "nonsense"];
        for (const s of stored) {
            for (const systemIsDark of [true, false]) {
                for (const path of ["/", "/blog", "/dashboard", "/dashboard/cases/x", "/try", "/sim-preview/library", "/dashboards"]) {
                    const expected = wantsDark(parsePreference(s), systemIsDark, path);
                    assert.equal(runScript(s, systemIsDark, path), expected, `${s} system=${systemIsDark} ${path}`);
                }
            }
        }
    });

    it("never throws, and leaves the page alone, when storage is blocked", () => {
        assert.doesNotThrow(() => runScript("dark", false, "/dashboard", true));
        assert.equal(runScript("dark", false, "/dashboard", true), "untouched");
    });

    it("is one self-contained statement (it is pasted into <head>)", () => {
        assert.ok(themeInitScript.startsWith("(function(){"));
        assert.ok(themeInitScript.endsWith("})()"));
        const asChoice: ThemePreference = "dark";
        assert.ok(asChoice);
    });
});
