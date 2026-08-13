import { extname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppProbe, probeAppProject, removeAppProject } from "./app-project.js";

const BUILD_TIMEOUT = 120_000;
const READY_MARKER = "app-created";
const WORKER_MARKER = "worker-ready";
const WORKER_MODULE = "probe-worker.mjs";
const WORKER_SOURCE_PATH = join("src", WORKER_MODULE);
const BUNDLE_PREFIX = "bundle.";
const WORKER_DIR = "workers/";
const OUT_DIR = "dist";
const NESTED_PACKAGE_DIR = "vendor";
const NESTED_OUT_DIR = join(NESTED_PACKAGE_DIR, OUT_DIR);
const NESTED_MANIFEST_PATH = join(NESTED_PACKAGE_DIR, "package.json");
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

const NESTED_MANIFEST = `${JSON.stringify({ name: "gtkx-app-probe-output", type: "commonjs" }, null, 4)}\n`;

const bundleNames = (emitted: string[]): string[] => emitted.filter((name) => name.startsWith(BUNDLE_PREFIX));

const workerExtensions = (emitted: string[]): string[] =>
    emitted.filter((name) => name.startsWith(WORKER_DIR)).map((name) => extname(name));

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
        expect(bundleNames(probe.emitted)).toEqual(["bundle.mjs"]);
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
            files: { [WORKER_SOURCE_PATH]: WORKER_MODULE_SOURCE },
            outDir: OUT_DIR,
            packageType: "commonjs",
            prefix: "gtkx-bundle-worker-commonjs-",
        });
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(probe.project);
    });

    it("names the worker chunk so node loads it as ESM", () => {
        expect(workerExtensions(probe.emitted)).toEqual([".mjs"]);
    });

    it("runs the worker when node runs the emitted file", () => {
        expectStarted(probe, WORKER_MARKER);
    });
});

describe("gtkx build (module package writing into a commonjs directory)", () => {
    let probe: AppProbe;

    beforeAll(async () => {
        probe = await probeAppProject({
            applicationId: "com.gtkx.clioutdirprobe",
            entry: WORKER_ENTRY,
            files: { [NESTED_MANIFEST_PATH]: NESTED_MANIFEST, [WORKER_SOURCE_PATH]: WORKER_MODULE_SOURCE },
            outDir: NESTED_OUT_DIR,
            packageType: "module",
            prefix: "gtkx-bundle-outdir-",
        });
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(probe.project);
    });

    it("names the entry after the manifest nearest the output, not the root", () => {
        expect(bundleNames(probe.emitted)).toEqual(["bundle.mjs"]);
    });

    it("names the worker chunk after the manifest nearest the output, not the root", () => {
        expect(workerExtensions(probe.emitted)).toEqual([".mjs"]);
    });

    it("returns the path it emitted", () => {
        expect(probe.reported).toBe(join(NESTED_OUT_DIR, "bundle.mjs"));
    });

    it("runs the worker when node runs the emitted file", () => {
        expectStarted(probe, WORKER_MARKER);
    });
});
