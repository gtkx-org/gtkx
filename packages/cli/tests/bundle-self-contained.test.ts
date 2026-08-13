import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type AppProject,
    type AppRun,
    buildAppProject,
    createAppProject,
    removeAppProject,
    runNode,
} from "./app-project.js";

type InstalledBundle = { project: AppProject; installDir: string; source: string; run: AppRun };
type ReactManifest = { version: string; description: string };
type ResolvingCase = { title: string; specifier: string; applicationId: string; prefix: string };

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const VERSION_PREFIX = "rendererVersion=";
const BUILD_TIMEOUT = 120_000;
const OUT_DIR = "dist";
const BUNDLE_NAME = "bundle.js";
const REACT_PACKAGE = "@gtkx/react";
const REACT_MANIFEST = `${REACT_PACKAGE}/package.json`;
const SIBLING_MANIFEST = "./package.json";
const MISSING_MODULE = "Cannot find module";
const WORKER_DIR = "workers";
const WORKER_NAME = "indexer.mjs";
const WORKER_SOURCE_PATH = join("src", WORKER_NAME);
const JS_EXTENSION = ".js";

const APP_ENTRY = String.raw`import { createRoot } from "@gtkx/react";

const injected = [];

globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: (internals) => {
        injected.push(internals.version);

        return 1;
    },
};

createRoot();

process.stdout.write("${VERSION_PREFIX}" + injected.join(",") + "\n");
`;

const WORKER_APP_ENTRY = `import { Worker } from "node:worker_threads";
import { createRoot } from "@gtkx/react";

const worker = new Worker(new URL("./${WORKER_NAME}", import.meta.url));

worker.on("message", (total) => {
    process.stdout.write("total=" + total);
});

createRoot();
`;

const WORKER_SOURCE = `import { parentPort } from "node:worker_threads";

parentPort?.postMessage(21 + 21);
`;

const RESOLVING_CASES: ResolvingCase[] = [
    {
        title: "a gtkx manifest resolved out of node_modules",
        specifier: REACT_MANIFEST,
        applicationId: "com.gtkx.clibundleresolver",
        prefix: "gtkx-bundle-resolver-",
    },
    {
        title: "a manifest read beside the bundle",
        specifier: SIBLING_MANIFEST,
        applicationId: "com.gtkx.clibundlesibling",
        prefix: "gtkx-bundle-sibling-",
    },
];

const resolvingEntry = (specifier: string): string => String.raw`import { createRequire } from "node:module";

globalThis.__gtkxLateVersion = () => createRequire(import.meta.url)("${specifier}").version;

process.stdout.write("started\n");
`;

const reactManifest = (): ReactManifest => {
    const manifest = readFileSync(join(WORKSPACE_ROOT, "packages", "react", "package.json"), "utf8");

    return JSON.parse(manifest) as ReactManifest;
};

const versionLiteral = (version: string): RegExp => {
    const escaped = version.split(".").join(String.raw`\.`);

    return new RegExp(String.raw`(["'\x60])${escaped}\1`);
};

const installBundle = (outDir: string): string => {
    const installDir = mkdtempSync(join(tmpdir(), "gtkx-bundle-install-"));
    cpSync(outDir, installDir, { recursive: true });

    return installDir;
};

const canResolveFromInstall = (installDir: string, specifier: string): boolean => {
    try {
        createRequire(join(installDir, BUNDLE_NAME)).resolve(specifier);

        return true;
    } catch {
        return false;
    }
};

describe("gtkx build (self-contained bundle)", () => {
    const state: InstalledBundle = {
        project: { root: "", entry: "" },
        installDir: "",
        source: "",
        run: { status: null, stdout: "", stderr: "" },
    };

    beforeAll(async () => {
        state.project = createAppProject({
            applicationId: "com.gtkx.clibundleprobe",
            entry: APP_ENTRY,
            packageType: "module",
            prefix: "gtkx-bundle-probe-",
        });

        await buildAppProject({ project: state.project, outDir: OUT_DIR });
        state.installDir = installBundle(join(state.project.root, OUT_DIR));
        state.source = readFileSync(join(state.installDir, BUNDLE_NAME), "utf8");
        state.run = runNode(join(state.installDir, BUNDLE_NAME));
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(state.project);
        rmSync(state.installDir, { recursive: true, force: true });
    });

    it("sits where node resolves neither the gtkx packages nor their manifests", () => {
        expect(canResolveFromInstall(state.installDir, REACT_PACKAGE)).toBe(false);
        expect(canResolveFromInstall(state.installDir, REACT_MANIFEST)).toBe(false);
    });

    it("starts from there anyway", () => {
        expect(state.run.stderr).not.toContain(MISSING_MODULE);
        expect(state.run.status).toBe(0);
    });

    it("reports the renderer version the react manifest carries", () => {
        expect(state.run.stdout.trim()).toBe(`${VERSION_PREFIX}${reactManifest().version}`);
    });

    it("stamps that version as a literal instead of carrying the manifest", () => {
        const manifest = reactManifest();
        expect(state.source).toMatch(versionLiteral(manifest.version));
        expect(state.source).not.toContain(manifest.description);
        expect(state.source).not.toMatch(/rendererVersion:\s*[\w$]+\(/);
    });
});

describe("gtkx build (worker chunks)", () => {
    it("holds every emitted chunk to the same rule", async () => {
        const project = createAppProject({
            applicationId: "com.gtkx.clibundleworker",
            entry: WORKER_APP_ENTRY,
            files: { [WORKER_SOURCE_PATH]: WORKER_SOURCE },
            packageType: "module",
            prefix: "gtkx-bundle-worker-",
        });

        try {
            await buildAppProject({ project, outDir: OUT_DIR });
            const emitted = readdirSync(join(project.root, OUT_DIR, WORKER_DIR));
            expect(emitted.map((name) => extname(name))).toEqual([JS_EXTENSION]);
        } finally {
            removeAppProject(project);
        }
    }, BUILD_TIMEOUT);
});

describe("gtkx build (bundle that would resolve a module at runtime)", () => {
    it.each(RESOLVING_CASES)(
        "fails the build over $title",
        async ({ specifier, applicationId, prefix }) => {
            const project = createAppProject({
                applicationId,
                entry: resolvingEntry(specifier),
                packageType: "module",
                prefix,
            });

            try {
                await expect(buildAppProject({ project, outDir: OUT_DIR })).rejects.toThrow(specifier);
            } finally {
                removeAppProject(project);
            }
        },
        BUILD_TIMEOUT,
    );
});
