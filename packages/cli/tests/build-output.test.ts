import { spawnSync } from "node:child_process";
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.clibuildoutput";
const BUNDLE = "bundle.mjs";
const CONFIG = `export default { applicationId: "${APPLICATION_ID}", codegen: false };\n`;
const APP_OUTPUT = join("build", "app");
const HELPER_OUTPUT = join("build", "helper");

const runBundle = (projectRoot: string, outDir: string): string => {
    const result = spawnSync(process.execPath, [join(projectRoot, outDir, BUNDLE)], {
        cwd: join(projectRoot, outDir),
        encoding: "utf8",
    });

    expect(result.status).toBe(0);

    return result.stdout;
};

const projectFiles = (): Record<string, string> => ({
    [join("src", "index.ts")]: 'process.stdout.write("application");\n',
    [join("src", "helper.ts")]: 'process.stdout.write("helper");\n',
});

describe("gtkx build (separate output directories)", () => {
    it("keeps independently runnable application and helper builds", () => {
        using project = createCliProject({
            prefix: "gtkx-build-output-",
            config: CONFIG,
            files: projectFiles(),
            hasStore: true,
        });

        runCliOrThrow(project, ["build", "src/helper.ts", "--out", HELPER_OUTPUT]);
        runCliOrThrow(project, ["build", "src/index.ts", "--out", APP_OUTPUT]);
        expect(runBundle(project.root, HELPER_OUTPUT)).toBe("helper");
        expect(runBundle(project.root, APP_OUTPUT)).toBe("application");
    });

    it("replaces an earlier GTKX build in the same selected directory", () => {
        using project = createCliProject({
            prefix: "gtkx-build-output-rebuild-",
            config: CONFIG,
            files: projectFiles(),
            hasStore: true,
        });

        runCliOrThrow(project, ["build", "src/helper.ts", "--out", HELPER_OUTPUT]);
        runCliOrThrow(project, ["build", "src/index.ts", "--out", HELPER_OUTPUT]);
        expect(runBundle(project.root, HELPER_OUTPUT)).toBe("application");
    });

    it("refuses directories that are outside, unsafe, or reached through a symlink", () => {
        using project = createCliProject({
            prefix: "gtkx-build-output-unsafe-",
            config: CONFIG,
            files: projectFiles(),
            hasStore: true,
        });

        symlinkSync(join(project.root, "src"), join(project.root, "linked-build"), "dir");
        expect(() => runCliOrThrow(project, ["build", "--out", "."])).toThrow();
        expect(() => runCliOrThrow(project, ["build", "--out", "src"])).toThrow();
        expect(() => runCliOrThrow(project, ["build", "--out", "../outside"])).toThrow();
        expect(() => runCliOrThrow(project, ["build", "--out", "linked-build"])).toThrow();
    });

    it("refuses a nonempty unowned default output directory", () => {
        using project = createCliProject({
            prefix: "gtkx-build-output-default-collision-",
            config: CONFIG,
            files: { ...projectFiles(), [join("dist", "user-data.txt")]: "keep" },
            hasStore: true,
        });

        expect(() => runCliOrThrow(project, ["build"])).toThrow();
    });
});
