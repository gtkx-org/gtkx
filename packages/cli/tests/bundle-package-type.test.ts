import { readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type AppProject,
    type AppRun,
    buildAppProject,
    createAppProject,
    removeAppProject,
    runNode,
} from "./app-project.js";

type BundleProbe = { project: AppProject; emitted: string; reported: string; run: AppRun };

const BUILD_TIMEOUT = 120_000;
const READY_MARKER = "app-created";
const BUNDLE_PREFIX = "bundle.";
const OUT_DIR = "dist";
const ESM_SYNTAX_ERROR = "Cannot use 'import.meta' outside a module";

const APP_ENTRY = String.raw`import { createRoot } from "@gtkx/react";

createRoot();

process.stdout.write("${READY_MARKER}\n");
`;

const emittedBundle = (outDir: string): string => {
    const found = readdirSync(outDir).find((name) => name.startsWith(BUNDLE_PREFIX));

    if (found === undefined) {
        throw new Error(`No bundle emitted in ${outDir}`);
    }

    return found;
};

describe("gtkx build (commonjs package)", () => {
    const state: BundleProbe = {
        project: { root: "", entry: "" },
        emitted: "",
        reported: "",
        run: { status: null, stdout: "", stderr: "" },
    };

    beforeAll(async () => {
        state.project = createAppProject({
            applicationId: "com.gtkx.clicommonjsprobe",
            entry: APP_ENTRY,
            packageType: "commonjs",
            prefix: "gtkx-bundle-commonjs-",
        });

        state.reported = await buildAppProject({ project: state.project, outDir: OUT_DIR });
        const outDir = join(state.project.root, OUT_DIR);
        state.emitted = emittedBundle(outDir);
        state.run = runNode(join(outDir, state.emitted));
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(state.project);
    });

    it("names the entry so node loads it as ESM", () => {
        expect(state.emitted).toBe("bundle.mjs");
    });

    it("starts when node runs the emitted file", () => {
        expect(state.run.stderr).not.toContain(ESM_SYNTAX_ERROR);
        expect(state.run.stdout).toContain(READY_MARKER);
        expect(state.run.status).toBe(0);
    });

    it("returns the path it emitted", () => {
        expect(state.reported).toBe(join(OUT_DIR, "bundle.mjs"));
    });
});
