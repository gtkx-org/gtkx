import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "../src/builder.js";

type AppRun = { status: number | null; stdout: string; stderr: string };
type BundleState = { projectRoot: string; installDir: string; run: AppRun };

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const VERSION_PREFIX = "rendererVersion=";
const BUILD_TIMEOUT = 120_000;
const RUN_TIMEOUT = 60_000;

const APP_CONFIG = `export default {
    applicationId: "com.gtkx.clibundleprobe",
    codegen: false,
    libraries: ["Gtk-4.0"],
};
`;

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

const createProject = (): string => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-bundle-project-"));
    mkdirSync(join(root, "src"));
    symlinkSync(join(WORKSPACE_ROOT, "node_modules"), join(root, "node_modules"), "dir");
    writeFileSync(join(root, "package.json"), "{ \"name\": \"gtkx-bundle-probe\", \"type\": \"module\" }\n");
    writeFileSync(join(root, "gtkx.config.mjs"), APP_CONFIG);
    writeFileSync(join(root, "src", "index.mjs"), APP_ENTRY);

    return root;
};

const removeProject = (root: string): void => {
    rmSync(join(root, "node_modules"), { force: true });
    rmSync(root, { recursive: true, force: true });
};

const runBundle = (installDir: string): AppRun => {
    const result = spawnSync(process.execPath, [join(installDir, "bundle.js")], {
        cwd: installDir,
        encoding: "utf8",
        timeout: RUN_TIMEOUT,
    });

    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

describe("gtkx build (self-contained bundle)", () => {
    const state: BundleState = { projectRoot: "", installDir: "", run: { status: null, stdout: "", stderr: "" } };

    beforeAll(async () => {
        state.projectRoot = createProject();
        state.installDir = mkdtempSync(join(tmpdir(), "gtkx-bundle-install-"));

        await build({
            entry: join(state.projectRoot, "src", "index.mjs"),
            vite: {
                root: state.projectRoot,
                logLevel: "warn",
                build: { outDir: state.installDir, emptyOutDir: true },
            },
        });

        state.run = runBundle(state.installDir);
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeProject(state.projectRoot);
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
