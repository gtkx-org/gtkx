import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const VERSION_PREFIX = "rendererVersion=";
const BUILD_TIMEOUT = 120_000;
const OUT_DIR = "dist";
const BUNDLE_NAME = "bundle.js";
const REACT_PACKAGE = "@gtkx/react";
const REACT_MANIFEST = `${REACT_PACKAGE}/package.json`;
const MISSING_MODULE = "Cannot find module";
const GTKX_MANIFEST_SPECIFIER = /@gtkx\/[^"'`\s]*\/package\.json/;

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

const LAZY_RESOLVING_ENTRY = String.raw`import { createRequire } from "node:module";

globalThis.__gtkxRendererVersion = () => createRequire(import.meta.url)("${REACT_MANIFEST}").version;

process.stdout.write("started\n");
`;

const reactVersion = (): string => {
    const manifest = readFileSync(join(WORKSPACE_ROOT, "packages", "react", "package.json"), "utf8");

    return (JSON.parse(manifest) as { version: string }).version;
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

    it("reports the renderer version stamped from the react manifest", () => {
        expect(state.run.stdout.trim()).toBe(`${VERSION_PREFIX}${reactVersion()}`);
    });

    it("carries no gtkx manifest specifier", () => {
        expect(state.source).not.toMatch(GTKX_MANIFEST_SPECIFIER);
    });
});

describe("gtkx build (bundle that would resolve a gtkx package at runtime)", () => {
    it("fails the build even when nothing on the startup path resolves", async () => {
        const project = createAppProject({
            applicationId: "com.gtkx.clibundleresolver",
            entry: LAZY_RESOLVING_ENTRY,
            packageType: "module",
            prefix: "gtkx-bundle-resolver-",
        });

        try {
            await expect(buildAppProject({ project, outDir: OUT_DIR })).rejects.toThrow(REACT_MANIFEST);
        } finally {
            removeAppProject(project);
        }
    }, BUILD_TIMEOUT);
});
