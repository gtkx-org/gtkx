import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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

type BundleState = { project: AppProject; installDir: string; run: AppRun };

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const VERSION_PREFIX = "rendererVersion=";
const BUILD_TIMEOUT = 120_000;

const APP_ENTRY = `import { createRoot } from "@gtkx/react";

const injected = [];

globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: (internals) => {
        injected.push(internals.version);

        return 1;
    },
};

createRoot();

process.stdout.write(\`${VERSION_PREFIX}\${injected.join(",")}\\n\`);
`;

const reactVersion = (): string => {
    const manifest = readFileSync(join(WORKSPACE_ROOT, "packages", "react", "package.json"), "utf8");

    return (JSON.parse(manifest) as { version: string }).version;
};

describe("gtkx build (self-contained bundle)", () => {
    const state: BundleState = {
        project: { root: "", entry: "" },
        installDir: "",
        run: { status: null, stdout: "", stderr: "" },
    };

    beforeAll(async () => {
        state.project = createAppProject({
            applicationId: "com.gtkx.clibundleprobe",
            entry: APP_ENTRY,
            packageType: "module",
            prefix: "gtkx-bundle-project-",
        });

        state.installDir = mkdtempSync(join(tmpdir(), "gtkx-bundle-install-"));
        const emitted = await buildAppProject({ project: state.project, outDir: state.installDir });
        state.run = runNode(emitted);
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(state.project);
        rmSync(state.installDir, { recursive: true, force: true });
    });

    it("starts where no node_modules resolves the gtkx packages", () => {
        expect(state.run.stderr).not.toContain("Cannot find module");
        expect(state.run.status).toBe(0);
    });

    it("reports the renderer version baked in at build time", () => {
        expect(state.run.stdout.trim()).toBe(`${VERSION_PREFIX}${reactVersion()}`);
    });
});
