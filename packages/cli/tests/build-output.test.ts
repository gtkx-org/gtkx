import { resolveExecutable } from "@gtkx/utils";
import { execFileSync, spawnSync } from "node:child_process";
import {
    chmodSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    renameSync,
    statSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.clibuildoutput";
const BUNDLE = "bundle.mjs";
const CONFIG = `export default { applicationId: "${APPLICATION_ID}", codegen: false };\n`;
const APP_OUTPUT = join("build", "app");
const HELPER_OUTPUT = join("build", "helper");
const PUBLIC_OUTPUT = join("public", "dist");
const MKFIFO = resolveExecutable("mkfifo");

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

    it("keeps a nested-first output protected by its unowned parent", () => {
        using project = createCliProject({
            prefix: "gtkx-build-output-nested-first-",
            config: CONFIG,
            files: projectFiles(),
            hasStore: true,
        });

        runCliOrThrow(project, ["build", "src/helper.ts", "--out", join("dist", "helper")]);
        expect(() => runCliOrThrow(project, ["build"])).toThrow();
    });

    it("refuses a nested output below an earlier GTKX build", () => {
        using project = createCliProject({
            prefix: "gtkx-build-output-managed-parent-",
            config: CONFIG,
            files: projectFiles(),
            hasStore: true,
        });

        runCliOrThrow(project, ["build"]);
        expect(() => runCliOrThrow(project, ["build", "src/helper.ts", "--out", join("dist", "helper")]))
            .toThrow();
    });

    it("rebuilds inside public without leaking transaction files", () => {
        using project = createCliProject({
            prefix: "gtkx-build-output-rebuild-",
            config: CONFIG,
            files: projectFiles(),
            hasStore: true,
        });

        runCliOrThrow(project, ["build", "src/helper.ts", "--out", PUBLIC_OUTPUT]);
        const output = join(project.root, PUBLIC_OUTPUT);
        const stale = join(output, "stale.txt");
        const gitConfig = join(output, ".git", "config");
        const generatedGitFile = join(output, ".git", "new");
        mkdirSync(join(output, ".git"));
        mkdirSync(join(project.root, "public", ".git"), { recursive: true });
        writeFileSync(stale, "stale");
        writeFileSync(gitConfig, "preserved");
        writeFileSync(join(project.root, "public", ".git", "new"), "generated");
        chmodSync(output, 0o750);
        const inode = statSync(output).ino;
        runCliOrThrow(project, ["build", "src/index.ts", "--out", PUBLIC_OUTPUT]);
        expect(runBundle(project.root, PUBLIC_OUTPUT)).toBe("application");
        expect(existsSync(stale)).toBe(false);
        expect(readFileSync(gitConfig, "utf8")).toBe("preserved");
        expect(readFileSync(generatedGitFile, "utf8")).toBe("generated");
        expect(statSync(output).ino).toBe(inode);
        expect(statSync(output).mode & 0o777).toBe(0o750);
        expect(readdirSync(output, { recursive: true }).some((name) => name.includes(".gtkx-output-"))).toBe(false);
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

    it("refuses a symlinked ownership manifest", () => {
        using project = createCliProject({
            prefix: "gtkx-build-output-marker-symlink-",
            config: CONFIG,
            files: projectFiles(),
            hasStore: true,
        });
        runCliOrThrow(project, ["build", "--out", HELPER_OUTPUT]);
        const manifest = join(project.root, HELPER_OUTPUT, "gtkx-schemas.json");
        const movedManifest = join(project.root, "moved-build-manifest.json");
        renameSync(manifest, movedManifest);
        symlinkSync(movedManifest, manifest);

        expect(() => runCliOrThrow(project, ["build", "--out", HELPER_OUTPUT])).toThrow();
    });

    it("refuses a FIFO ownership manifest without blocking", () => {
        using project = createCliProject({
            prefix: "gtkx-build-output-marker-fifo-",
            config: CONFIG,
            files: projectFiles(),
            hasStore: true,
        });
        runCliOrThrow(project, ["build", "--out", HELPER_OUTPUT]);
        const manifest = join(project.root, HELPER_OUTPUT, "gtkx-schemas.json");
        renameSync(manifest, join(project.root, "moved-build-manifest.json"));
        execFileSync(MKFIFO, [manifest]);

        expect(() => runCliOrThrow(project, ["build", "--out", HELPER_OUTPUT])).toThrow();
    });

    it("fails a rebuild with an unresolved import", () => {
        using project = createCliProject({
            prefix: "gtkx-build-output-rollback-",
            config: CONFIG,
            files: {
                ...projectFiles(),
                [join("src", "broken.ts")]: 'import "./missing.js";\n',
            },
            hasStore: true,
        });
        runCliOrThrow(project, ["build", "src/helper.ts", "--out", HELPER_OUTPUT]);

        expect(() => runCliOrThrow(project, ["build", "src/broken.ts", "--out", HELPER_OUTPUT])).toThrow();
    });
});
