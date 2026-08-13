import { rmSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type AppProbe,
    type AppRun,
    installBundle,
    probeAppProject,
    removeAppProject,
    runNode,
} from "./app-project.js";

const BUILD_TIMEOUT = 120_000;
const READY_MARKER = "app-created";
const WORKER_MARKER = "worker-ready";
const WORKER_MODULE = "probe-worker.mjs";
const WORKER_SOURCE_PATH = join("src", WORKER_MODULE);
const BUNDLE_NAME = "bundle.mjs";
const BUNDLE_PREFIX = "bundle.";
const WORKER_DIR = "workers/";
const OUT_DIR = "dist";
const MANIFEST_NAME = "package.json";
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

const INSTALL_MANIFEST = `${JSON.stringify({ name: "gtkx-app-install", type: "commonjs" }, null, 4)}\n`;

const bundleNames = (emitted: string[]): string[] => emitted.filter((name) => name.startsWith(BUNDLE_PREFIX));

const workerExtensions = (emitted: string[]): string[] =>
    emitted.filter((name) => name.startsWith(WORKER_DIR)).map((name) => extname(name));

const expectStarted = (run: AppRun, marker: string): void => {
    expect(run.stderr).not.toContain(ESM_SYNTAX_ERROR);
    expect(run.stdout).toContain(marker);
    expect(run.status).toBe(0);
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

    it("names the entry so node loads it as ESM, and reports the path it emitted", () => {
        expect(bundleNames(probe.emitted)).toEqual([BUNDLE_NAME]);
        expect(probe.reported).toBe(join(OUT_DIR, BUNDLE_NAME));
        expectStarted(probe.run, READY_MARKER);
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

    it("names the worker chunk so node loads it as ESM, and runs it", () => {
        expect(workerExtensions(probe.emitted)).toEqual([extname(BUNDLE_NAME)]);
        expectStarted(probe.run, WORKER_MARKER);
    });
});

describe("gtkx build (module package)", () => {
    let probe: AppProbe;
    let installDir: string;
    let installed: AppRun;

    beforeAll(async () => {
        probe = await probeAppProject({
            applicationId: "com.gtkx.cliworkermodule",
            entry: WORKER_ENTRY,
            files: { [WORKER_SOURCE_PATH]: WORKER_MODULE_SOURCE },
            outDir: OUT_DIR,
            packageType: "module",
            prefix: "gtkx-bundle-worker-module-",
        });

        installDir = installBundle(join(probe.project.root, OUT_DIR), { [MANIFEST_NAME]: INSTALL_MANIFEST });
        installed = runNode(join(installDir, basename(probe.reported)));
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(probe.project);
        rmSync(installDir, { recursive: true, force: true });
    });

    it("names the entry and the worker chunk the way it names them for a commonjs package", () => {
        expect(bundleNames(probe.emitted)).toEqual([BUNDLE_NAME]);
        expect(workerExtensions(probe.emitted)).toEqual([extname(BUNDLE_NAME)]);
        expect(probe.reported).toBe(join(OUT_DIR, BUNDLE_NAME));
    });

    it("runs the worker from the project and from an install directory that declares commonjs", () => {
        expectStarted(probe.run, WORKER_MARKER);
        expectStarted(installed, WORKER_MARKER);
    });
});
