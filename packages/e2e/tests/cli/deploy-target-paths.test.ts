import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli, runCliOrThrow } from "./cli-project.js";

const APPLICATION_ID = "org.gtkx.target-paths";
const ARTIFACT_NAME = "target-paths.AppImage";
const PACKAGE = { name: "gtkx-target-paths", version: "1.0.0", type: "module" };
const LOCKFILE = JSON.stringify({ ...PACKAGE, lockfileVersion: 3, packages: { "": PACKAGE } });
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>';
const SOURCE = `mode: "source", packageManager: "npm",
    source: {
        url: "https://github.com/gtkx-org/cli-deploy-probe.git",
        commit: "4c1d0f7b2a9e5c38f61b0d47ae92c5138b7ff204",
    }`;
const SOURCE_ARGS = ["deploy", "--print-manifests", "--target", "flatpak"];

const config = (target: string): string => `export default {
    applicationId: "${APPLICATION_ID}",
    applicationIcon: "application.svg",
    codegen: false,
    deploy: {
        name: "Target Paths",
        binaryName: "gtkx-target-paths",
        developer: { name: "GTKX" },
        summary: "Tests package inputs relative to the project",
        description: ["An application that exercises package file inputs and temporary staging cleanup."],
        categories: ["Utility"],
        homepage: "https://gtkx.dev",
        license: "MPL-2.0",
        metadataLicense: "CC0-1.0",
        node: { source: "host", shouldStrip: false },
        ${target}
    },
};`;

const files = (): Record<string, string> => ({
    "application.svg": ICON,
    "src/index.ts": 'process.stdout.write("target paths");',
    "package.json": JSON.stringify(PACKAGE),
    "package-lock.json": LOCKFILE,
});

describe("deploy target file paths", () => {
    it.each(["relative", "absolute"])("packages a custom AppImage runtime from a %s project path", (kind) => {
        using project = createCliProject({
            prefix: "gtkx-appimage-runtime-path-",
            config: config(`appimage: { fileName: "${ARTIFACT_NAME}" },`),
            files: files(),
            hasStore: true,
        });
        runCliOrThrow(project, ["deploy", "--target", "appimage"]);
        const artifact = join(project.root, "build", "out", ARTIFACT_NAME);
        const offset = spawnSync(artifact, ["--appimage-offset"], { encoding: "utf8", timeout: 60_000 });
        expect(offset.status).toBe(0);
        const runtimePath = join(project.root, "custom runtime");
        const runtimeLength = Number(offset.stdout.trim());
        writeFileSync(runtimePath, readFileSync(artifact).subarray(0, runtimeLength));
        const path = kind === "relative" ? "custom runtime" : runtimePath;
        writeFileSync(join(project.root, "gtkx.config.ts"), config(`appimage: {
            fileName: "${ARTIFACT_NAME}", runtimeFile: ${JSON.stringify(path)},
        },`));
        runCliOrThrow(project, ["deploy", "--target", "appimage"]);
        const extraction = spawnSync(artifact, ["--appimage-extract", `${APPLICATION_ID}.svg`], {
            cwd: project.root,
            encoding: "utf8",
            timeout: 60_000,
        });
        expect(extraction.status).toBe(0);
        expect(readFileSync(join(project.root, "squashfs-root", `${APPLICATION_ID}.svg`), "utf8")).toBe(ICON);
    });

    it("rejects a missing custom AppImage runtime", () => {
        using project = createCliProject({
            prefix: "gtkx-appimage-missing-runtime-",
            config: config('appimage: { runtimeFile: "missing runtime" },'),
            files: files(),
            hasStore: true,
        });
        expect(runCli(project, ["deploy", "--target", "appimage"]).status).not.toBe(0);
    });

    it.each(["default", "relative", "absolute"])("uses a %s lockfile and releases its temporary staging", (kind) => {
        using project = createCliProject({
            prefix: "gtkx-flatpak-lockfile-path-",
            config: config(`flatpak: { ${SOURCE} },`),
            files: { ...files(), "lockfile directory/package-lock.json": LOCKFILE },
            hasStore: true,
        });
        if (kind !== "default") {
            const path = kind === "relative"
                ? "lockfile directory/package-lock.json"
                : join(project.root, "lockfile directory", "package-lock.json");
            writeFileSync(join(project.root, "gtkx.config.ts"), config(`flatpak: {
                ${SOURCE}, lockfile: ${JSON.stringify(path)},
            },`));
        }
        const temporary = join(project.root, "temporary");
        mkdirSync(temporary);
        runCliOrThrow(project, SOURCE_ARGS, { TMPDIR: temporary });
        const generated = join(project.root, "build", process.arch, "targets", "flatpak", "generated-sources.json");
        expect(JSON.parse(readFileSync(generated, "utf8"))).toEqual(expect.any(Array));
        expect(readdirSync(temporary).filter((name) => name.startsWith("gtkx-lockfile-"))).toEqual([]);
    });

    it.each(["missing", "directory", "malformed"])("releases lockfile staging after a %s input fails", (kind) => {
        using project = createCliProject({
            prefix: "gtkx-flatpak-lockfile-error-",
            config: config(`flatpak: { ${SOURCE}, lockfile: "invalid package-lock.json" },`),
            files: files(),
            hasStore: true,
        });
        const lockfile = join(project.root, "invalid package-lock.json");
        if (kind === "directory") {
            mkdirSync(lockfile);
        } else if (kind === "malformed") {
            writeFileSync(lockfile, "{");
        }
        const temporary = join(project.root, "temporary");
        mkdirSync(temporary);
        expect(runCli(project, SOURCE_ARGS, { TMPDIR: temporary }).status).not.toBe(0);
        expect(readdirSync(temporary).filter((name) => name.startsWith("gtkx-lockfile-"))).toEqual([]);
    });
});
