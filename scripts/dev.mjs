#!/usr/bin/env node
/**
 * scripts/dev.mjs
 * ============================================================
 * `npm run dev`: the Next.js dev server on Turbopack, with a memory ceiling.
 *
 * Why the ceiling: in development Next restarts its own server when the JavaScript
 * heap passes 80% of --max-old-space-size (it checks after every request and prints
 * "Server is approaching the used memory threshold, restarting..."). Unless that flag
 * is set, Next picks half of the machine's RAM for it, so on a 24 GB machine the guard
 * sits at about 10 GB and never fires: the server just keeps growing until the whole
 * machine is slow. Turbopack's heap grows faster than webpack's per save, so it needs
 * the guard more. With the ceiling below, a restart takes a few seconds and the next
 * page you open compiles again.
 *
 *   npm run dev                      Turbopack
 *   npm run dev:webpack              webpack, same ceiling
 *   DEV_HEAP_MB=4096 npm run dev     a different ceiling   (PowerShell: $env:DEV_HEAP_MB=4096; npm run dev)
 *   npm run dev -- -p 3001           anything else goes to `next dev`
 *
 * A NODE_OPTIONS that already sets --max-old-space-size wins over the default here.
 * Production (`npm run build`) is unchanged and still uses webpack, which the
 * service worker plugin (Serwist) needs.
 * ============================================================
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextBin = path.join(path.dirname(require.resolve("next/package.json")), "dist", "bin", "next");

const args = process.argv.slice(2);
const useWebpack = args.includes("--webpack");
const passthrough = args.filter((arg) => arg !== "--webpack");

const heapMb = Number(process.env.DEV_HEAP_MB) || 3072;
const nodeOptions = process.env.NODE_OPTIONS ?? "";
if (!nodeOptions.includes("--max-old-space-size")) {
    process.env.NODE_OPTIONS = `${nodeOptions} --max-old-space-size=${heapMb}`.trim();
    console.log(`dev: heap ceiling ${heapMb} MB; the dev server restarts itself when it gets close to it`);
}

const child = spawn(process.execPath, [nextBin, "dev", ...(useWebpack ? [] : ["--turbopack"]), ...passthrough], { stdio: "inherit" });

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
