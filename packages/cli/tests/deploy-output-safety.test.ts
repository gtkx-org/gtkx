import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    renameSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.deployoutputsafety";
const MKFIFO = resolveExecutable("mkfifo");

const deployConfig = (outDir?: string): string => `export default {
    applicationId: "${APPLICATION_ID}",
    applicationIcon: "application.svg",
    codegen: false,
    deploy: {
        name: "Deploy Output Safety",
        developer: { name: "GTKX" },
        summary: "Exercises deployment output ownership",
        description: ["An integration probe for deployment output directory safety."],
        categories: ["Utility"],
        license: "MPL-2.0",
        metadataLicense: "CC0-1.0",
        ${outDir === undefined ? "" : `outDir: ${JSON.stringify(outDir)},`}
    },
};
`;

const projectFiles = (): Record<string, string> => ({
    "application.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>\n',
    [join("src", "index.ts")]: 'process.stdout.write("application");\n',
});

describe("gtkx deploy output ownership", () => {
    it("reuses an output directory created by an earlier GTKX deploy", () => {
        using project = createCliProject({
            prefix: "gtkx-deploy-output-reuse-",
            config: deployConfig(),
            files: projectFiles(),
            hasStore: true,
        });

        const args = ["deploy", "--print-manifests", "--target", "deb"];
        runCliOrThrow(project, args);
        const stale = join(project.root, "build", "stale.txt");
        writeFileSync(stale, "stale");
        runCliOrThrow(project, args);
        expect(existsSync(stale)).toBe(false);
    });

    it("rejects a deploy output reached through a symlink", () => {
        const outside = mkdtempSync(join(tmpdir(), "gtkx-deploy-output-outside-"));

        try {
            using project = createCliProject({
                prefix: "gtkx-deploy-output-symlink-",
                config: deployConfig("linked-output"),
                files: projectFiles(),
                hasStore: true,
            });
            symlinkSync(outside, join(project.root, "linked-output"), "dir");
            expect(() => runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "deb"])).toThrow();
        } finally {
            rmSync(outside, { recursive: true, force: true });
        }
    });

    it("rejects a nonempty output directory GTKX does not own", () => {
        using project = createCliProject({
            prefix: "gtkx-deploy-output-collision-",
            config: deployConfig(),
            files: projectFiles(),
            hasStore: true,
        });
        mkdirSync(join(project.root, "build", "stage"), { recursive: true });

        expect(() => runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "deb"])).toThrow();
    });

    it("rejects a symlinked deploy ownership marker", () => {
        using project = createCliProject({
            prefix: "gtkx-deploy-output-marker-symlink-",
            config: deployConfig(),
            files: projectFiles(),
            hasStore: true,
        });
        const args = ["deploy", "--print-manifests", "--target", "deb"];
        runCliOrThrow(project, args);
        const marker = join(project.root, "build", ".gtkx-deploy.json");
        const movedMarker = join(project.root, "moved-deploy-marker.json");
        renameSync(marker, movedMarker);
        symlinkSync(movedMarker, marker);

        expect(() => runCliOrThrow(project, args)).toThrow();
    });

    it("rejects a FIFO deploy ownership marker without blocking", () => {
        using project = createCliProject({
            prefix: "gtkx-deploy-output-marker-fifo-",
            config: deployConfig(),
            files: projectFiles(),
            hasStore: true,
        });
        const args = ["deploy", "--print-manifests", "--target", "deb"];
        runCliOrThrow(project, args);
        const marker = join(project.root, "build", ".gtkx-deploy.json");
        renameSync(marker, join(project.root, "moved-deploy-marker.json"));
        execFileSync(MKFIFO, [marker]);

        expect(() => runCliOrThrow(project, args)).toThrow();
    });

    it("does not follow symlinks left inside an owned deploy output", () => {
        const outside = mkdtempSync(join(tmpdir(), "gtkx-deploy-output-descendant-"));

        try {
            using project = createCliProject({
                prefix: "gtkx-deploy-output-descendant-symlink-",
                config: deployConfig(),
                files: projectFiles(),
                hasStore: true,
            });
            const args = ["deploy", "--print-manifests", "--target", "deb"];
            runCliOrThrow(project, args);
            rmSync(join(project.root, "build", "metadata"), { recursive: true });
            symlinkSync(outside, join(project.root, "build", "metadata"), "dir");
            writeFileSync(join(outside, "keep.txt"), "keep");

            runCliOrThrow(project, args);
            expect(readFileSync(join(outside, "keep.txt"), "utf8")).toBe("keep");
        } finally {
            rmSync(outside, { recursive: true, force: true });
        }
    });

    it("rejects a nonempty unowned build output before rebuilding for deploy", () => {
        using project = createCliProject({
            prefix: "gtkx-deploy-build-output-collision-",
            config: deployConfig(),
            files: { ...projectFiles(), [join("dist", "user-data.txt")]: "keep" },
            hasStore: true,
        });

        expect(() => runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "deb"])).toThrow();
    });

    it.each(["dist", "dist/deploy"])("rejects a deploy output that overlaps the build output", (outDir) => {
        using project = createCliProject({
            prefix: "gtkx-deploy-output-overlap-",
            config: deployConfig(outDir),
            files: projectFiles(),
            hasStore: true,
        });

        expect(() => runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "deb"])).toThrow();
    });
});
