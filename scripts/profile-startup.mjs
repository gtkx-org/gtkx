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

const CLASSIFY_RULES = [
    { test: ({ fn }) => fn === "(idle)" || fn === "(program)" || fn === "(root)", category: "idle/wait" },
    { test: ({ fn }) => fn === "(garbage collector)", category: "gc" },
    { test: ({ url }) => url.includes("/.gtkx/gi/"), category: "gi-bindings eval" },
    {
        test: ({ url }) => url.includes("/packages/ffi/") || url.includes("@gtkx/ffi"),
        category: "ffi (native GTK calls)",
    },
    {
        test: ({ url }) => url.includes("/packages/native/") || url.endsWith(".node"),
        category: "ffi (native GTK calls)",
    },
    {
        test: ({ url }) =>
            url.includes("react-reconciler") || url.includes("/packages/react/") || url.includes("scheduler/"),
        category: "react render/reconciler",
    },
    {
        test: ({ url }) => url.includes("babel-plugin-react-compiler") || url.includes("/@babel/"),
        category: "React Compiler (babel)",
    },
    {
        test: ({ url }) => url.includes("browserslist") || url.includes("caniuse") || url.includes("/semver/"),
        category: "React Compiler (babel)",
    },
    {
        test: ({ fn, url }) => fn === "spawnSync" || url.includes("gresources") || url.includes("child_process"),
        category: "glib-compile-resources (subprocess)",
    },
    { test: ({ url }) => url.includes("esbuild"), category: "esbuild TS transform" },
    {
        test: ({ url }) => url.includes("/vite/") || url.includes("rolldown") || url.includes("magic-string"),
        category: "vite core (bundler/sourcemap)",
    },
    { test: ({ url }) => url.startsWith("node:"), category: "node module load/compile" },
    { test: ({ url }) => url.includes("/examples/"), category: "app code (user)" },
    { test: ({ url }) => url === "", category: "vm-internal" },
];

const classify = (frame) => {
    const fn = frame.functionName || "(anonymous)";
    const url = frame.url || "";
    const rule = CLASSIFY_RULES.find(({ test }) => test({ fn, url }));
    return rule ? rule.category : "other";
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
