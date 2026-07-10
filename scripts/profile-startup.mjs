import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exampleDir = resolve(process.argv[2] ?? join(repo, "examples/gtk-demo"));
const entry = join(exampleDir, "src/index.tsx");
const runner = join(repo, "packages/cli/bin/gtkx-dev-runner.js");
const outDir = join(exampleDir, "node_modules/.cache/gtkx-profile");
const profilePath = join(outDir, "startup.cpuprofile");
const runMs = Number(process.env.GTKX_PROFILE_MS ?? 9000);

const { resolveHeadlessOptions, startHeadlessDisplay, STATIC_HEADLESS_ENV } = await import(
    join(repo, "packages/vitest/dist/headless-display.js")
);

mkdirSync(outDir, { recursive: true });
Object.assign(process.env, STATIC_HEADLESS_ENV);
const teardown = await startHeadlessDisplay(resolveHeadlessOptions({}));

const t0 = performance.now();
const stamp = () => `+${((performance.now() - t0) / 1000).toFixed(3)}s`;
const emit = (src, text) => {
    for (const line of text.split("\n")) if (line.trim()) process.stdout.write(`[${stamp()}] ${src} | ${line}\n`);
};

const child = spawn(
    process.execPath,
    [
        "--cpu-prof",
        "--cpu-prof-dir",
        outDir,
        "--cpu-prof-name",
        "startup.cpuprofile",
        "--cpu-prof-interval",
        "200",
        runner,
        entry,
    ],
    { cwd: exampleDir, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (d) => emit("out", d));
child.stderr.on("data", (d) => emit("err", d));

const killTimer = setTimeout(() => {
    child.kill("SIGINT");
    setTimeout(() => child.exitCode === null && child.kill("SIGKILL"), 6000);
}, runMs);

child.on("exit", () => {
    clearTimeout(killTimer);
    teardown();
    report(profilePath);
    process.exit(0);
});

const classify = (frame) => {
    const fn = frame.functionName || "(anonymous)";
    const url = frame.url || "";
    if (fn === "(idle)" || fn === "(program)" || fn === "(root)") return "idle/wait";
    if (fn === "(garbage collector)") return "gc";
    if (url.includes("/.gtkx/gi/")) return "gi-bindings eval";
    if (url.includes("/packages/ffi/") || url.includes("@gtkx/ffi")) return "ffi (native GTK calls)";
    if (url.includes("/packages/native/") || url.endsWith(".node")) return "ffi (native GTK calls)";
    if (url.includes("react-reconciler") || url.includes("/packages/react/") || url.includes("scheduler/")) {
        return "react render/reconciler";
    }
    if (url.includes("babel-plugin-react-compiler") || url.includes("/@babel/")) return "React Compiler (babel)";
    if (url.includes("browserslist") || url.includes("caniuse") || url.includes("/semver/")) {
        return "React Compiler (babel)";
    }
    if (fn === "spawnSync" || url.includes("gresources") || url.includes("child_process")) {
        return "glib-compile-resources (subprocess)";
    }
    if (url.includes("esbuild")) return "esbuild TS transform";
    if (url.includes("/vite/") || url.includes("rolldown") || url.includes("magic-string")) {
        return "vite core (bundler/sourcemap)";
    }
    if (url.startsWith("node:")) return "node module load/compile";
    if (url.includes("/examples/")) return "app code (user)";
    if (url === "") return "vm-internal";
    return "other";
};

function report(file) {
    const prof = JSON.parse(readFileSync(file, "utf8"));
    const nodes = new Map(prof.nodes.map((n) => [n.id, n]));
    const bucket = new Map();
    const binBusy = new Map();
    let total = 0;
    let idle = 0;
    let cum = prof.startTime;
    for (let i = 0; i < prof.samples.length; i++) {
        const dt = prof.timeDeltas[i];
        cum += dt;
        if (dt <= 0) continue;
        const b = classify(nodes.get(prof.samples[i]).callFrame);
        bucket.set(b, (bucket.get(b) || 0) + dt);
        total += dt;
        if (b === "idle/wait") idle += dt;
        else binBusy.set(Math.floor((cum - prof.startTime) / 100000), true);
    }
    let firstIdle = 0;
    for (let bin = 0; binBusy.has(bin) || binBusy.has(bin + 1) || binBusy.has(bin + 2); bin++) {
        firstIdle = (bin + 1) * 100;
    }
    const ms = (u) => (u / 1000).toFixed(0).padStart(5);
    const busy = total - idle;
    process.stdout.write(`\n${"=".repeat(60)}\nSTARTUP CPU PROFILE  (${exampleDir})\n${"=".repeat(60)}\n`);
    process.stdout.write(`time to first render (main thread goes idle): ~${(firstIdle / 1000).toFixed(1)}s\n`);
    process.stdout.write(`busy CPU during startup: ${(busy / 1000).toFixed(0)} ms\n`);
    process.stdout.write(`profile saved: ${file}  (open in chrome://inspect or speedscope.app)\n\n`);
    for (const [k, v] of [...bucket.entries()].filter(([k]) => k !== "idle/wait").sort((a, b) => b[1] - a[1])) {
        process.stdout.write(`  ${ms(v)} ms  ${`${((v / busy) * 100).toFixed(1)}%`.padStart(6)}   ${k}\n`);
    }
}
