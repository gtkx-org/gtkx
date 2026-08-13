import { extname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppProbe, probeAppProject, removeAppProject } from "./app-project.js";

const BUILD_TIMEOUT = 120_000;
const READY_MARKER = "app-created";
const WORKER_MARKER = "worker-ready";
const WORKER_MODULE = "probe-worker.mjs";
const WORKER_DIR = "workers/";
const OUT_DIR = "dist";
const ESM_SYNTAX_ERROR = "Cannot use 'import.meta' outside a module";

const APP_ENTRY = String.raw`import { createRoot } from "@gtkx/react";

createRoot();

process.stdout.write("${READY_MARKER}\n");
`;

const WORKER_ENTRY = String.raw`import { Worker } from "node:worker_threads";

const worker = new Worker(new URL("./${WORKER_MODULE}", import.meta.url));

worker.on("message", (message) => {
    process.stdout.write(message + "\n");
});

worker.on("error", (error) => {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
});
`;

const WORKER_MODULE_SOURCE = `import { parentPort } from "node:worker_threads";

parentPort?.postMessage("${WORKER_MARKER}");
`;

const workerChunks = (emitted: string[]): string[] => emitted.filter((name) => name.startsWith(WORKER_DIR));

const expectStarted = (probe: AppProbe, marker: string): void => {
    expect(probe.run.stderr).not.toContain(ESM_SYNTAX_ERROR);
    expect(probe.run.stdout).toContain(marker);
    expect(probe.run.status).toBe(0);
};

describe("gtkx build (commonjs package)", () => {
    let probe: AppProbe;

    beforeAll(async () => {
        probe = await probeAppProject({
            applicationId: "com.gtkx.clicommonjsprobe",
            entry: APP_ENTRY,
            outDir: OUT_DIR,
            packageType: "commonjs",
            prefix: "gtkx-bundle-commonjs-",
        });
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(probe.project);
    });

    it("names the entry so node loads it as ESM", () => {
        expect(probe.emitted).toContain("bundle.mjs");
    });

    it("starts when node runs the emitted file", () => {
        expectStarted(probe, READY_MARKER);
    });

    it("returns the path it emitted", () => {
        expect(probe.reported).toBe(join(OUT_DIR, "bundle.mjs"));
    });
});

describe("gtkx build (commonjs package with a worker)", () => {
    let probe: AppProbe;

    beforeAll(async () => {
        probe = await probeAppProject({
            applicationId: "com.gtkx.cliworkercommonjs",
            entry: WORKER_ENTRY,
            modules: { [WORKER_MODULE]: WORKER_MODULE_SOURCE },
            outDir: OUT_DIR,
            packageType: "commonjs",
            prefix: "gtkx-bundle-worker-commonjs-",
        });
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(probe.project);
    });

    it("names the worker chunk so node loads it as ESM", () => {
        expect(workerChunks(probe.emitted).map((name) => extname(name))).toEqual([".mjs"]);
    });

    it("runs the worker when node runs the emitted file", () => {
        expectStarted(probe, WORKER_MARKER);
    });
});
