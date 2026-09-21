#!/usr/bin/env node
/**
 * scripts/run-sim-tests.mjs
 * ============================================================
 * Runs the simulation-engine unit tests.
 *
 * The repo has no test framework, and `next build` sets ignoreBuildErrors, so
 * this does two jobs with zero extra dependencies:
 *
 *   1. Type-checks the simulation library + tests with the project's own
 *      TypeScript (a type error here fails the run).
 *   2. Runs the compiled tests with Node's built-in test runner.
 *
 * Only *.test.ts files are entry points, so tsc follows their imports and
 * compiles just what they touch — not the whole Next.js app.
 *
 *   npm run test:sim
 *   npm run test:sim -- --grep "reperfusion"    (forwarded to node --test as --test-name-pattern)
 * ============================================================
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "node_modules", ".cache", "sim-tests");
const SEARCH_DIRS = ["lib", "engine", "data"];

function findTests(dir) {
    const found = [];
    if (!existsSync(dir)) return found;
    for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === ".next") continue;
        const full = path.join(dir, name);
        const stat = statSync(full);
        if (stat.isDirectory()) found.push(...findTests(full));
        else if (name.endsWith(".test.ts")) found.push(full);
    }
    return found;
}

const tests = SEARCH_DIRS.flatMap((d) => findTests(path.join(root, d)));
if (tests.length === 0) {
    console.error("No *.test.ts files found under", SEARCH_DIRS.join(", "));
    process.exit(1);
}

// Optional --grep <pattern>
const args = process.argv.slice(2);
const grepIndex = args.indexOf("--grep");
const grep = grepIndex >= 0 ? args[grepIndex + 1] : undefined;

// ── 1. Compile ──────────────────────────────────────────────────────────────
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
const compile = spawnSync(
    process.execPath,
    [
        tsc,
        "--outDir", outDir,
        "--rootDir", root,
        "--module", "commonjs",
        "--moduleResolution", "node10",
        "--target", "es2020",
        "--lib", "es2022",
        "--strict",
        "--esModuleInterop",
        "--resolveJsonModule",
        "--skipLibCheck",
        "--types", "node",
        ...tests,
    ],
    { cwd: root, stdio: "inherit" }
);

if (compile.status !== 0) {
    console.error("\nType-check failed — fix the errors above before the tests can run.");
    process.exit(compile.status ?? 1);
}

// ── 2. Run ──────────────────────────────────────────────────────────────────
const compiled = tests.map((t) =>
    path.join(outDir, path.relative(root, t).replace(/\.ts$/, ".js"))
);
const run = spawnSync(
    process.execPath,
    ["--test", ...(grep ? ["--test-name-pattern", grep] : []), ...compiled],
    { cwd: root, stdio: "inherit" }
);
process.exit(run.status ?? 1);
