import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli, runCliOrThrow } from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.deployoutputsafety";

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

    it.each(["symlink", "directory", "invalid"])("rejects a %s deployment marker", (kind) => {
        using project = createCliProject({
            prefix: "gtkx-deploy-output-marker-",
            config: deployConfig(),
            files: { ...projectFiles(), [join("build", "user-data.txt")]: "keep" },
            hasStore: true,
        });
        const marker = join(project.root, "build", ".gtkx-deploy.json");

        if (kind === "symlink") {
            const target = join(project.root, "marker.json");
            writeFileSync(target, `${JSON.stringify({ generator: "gtkx-deploy", formatVersion: 1 })}\n`);
            symlinkSync(target, marker);
        } else if (kind === "directory") {
            mkdirSync(marker);
        } else {
            writeFileSync(marker, "invalid");
        }

        expect(runCli(project, ["deploy", "--print-manifests", "--target", "deb"]).status).toBe(1);
        expect(readFileSync(join(project.root, "build", "user-data.txt"), "utf8")).toBe("keep");
    });

    it("keeps the previous deployment when its application build fails", () => {
        using project = createCliProject({
            prefix: "gtkx-deploy-output-rollback-",
            config: deployConfig(),
            files: projectFiles(),
            hasStore: true,
        });
        const args = ["deploy", "--print-manifests", "--target", "deb"];
        runCliOrThrow(project, args);
        const retained = join(project.root, "build", "retained.txt");
        writeFileSync(retained, "retained");
        writeFileSync(join(project.root, "src", "index.ts"), 'import "./missing.js";\n');

        expect(() => runCliOrThrow(project, args)).toThrow();
        expect(existsSync(retained)).toBe(true);
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
