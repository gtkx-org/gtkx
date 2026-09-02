import { readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli, runCliOrThrow } from "./cli-project.js";
import {
    APPLICATION_ID,
    bareConfig,
    BUILD_METADATA,
    type BuildMetadata,
    config,
    DEPLOY_BLOCK,
    FOREIGN_INVENTORY,
    LIBRARIES_INVENTORY,
    NFPM_PATH,
    packagedDepends,
    projectFiles,
    SCHEMA,
} from "./deploy-helpers.js";

describe("gtkx deploy (a store inventory it cannot use)", () => {
    const project: CliProject = { root: "", nodeModules: "" };
    const statuses: (number | null)[] = [];
    const dependencies: string[][] = [];

    beforeAll(() => {
        const created = createCliProject({
            prefix: "gtkx-cli-foreign-",
            config: bareConfig(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        project.root = created.root;
        project.nodeModules = created.nodeModules;
        runCli(project, ["deploy", "--print-manifests", "--target", "deb"]);
        const inventory = join(project.root, LIBRARIES_INVENTORY);

        for (const mutate of [
            () => {
                writeFileSync(inventory, FOREIGN_INVENTORY);
            },
            () => {
                rmSync(inventory, { force: true });
            },
        ]) {
            mutate();
            statuses.push(runCli(project, ["deploy", "--print-manifests", "--skip-build", "--target", "deb"]).status);
            dependencies.push(packagedDepends(project, NFPM_PATH));
        }
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("falls back to its default libraries without inventing minimum versions", () => {
        expect(statuses).toEqual([0, 0]);

        for (const packaged of dependencies) {
            expect(packaged).toContain("libgtk-4-1");
            expect(packaged).toContain("libadwaita-1-0");
            const versionedToolkit = packaged.filter((entry) =>
                (entry.startsWith("libgtk") || entry.startsWith("libadwaita")) && entry.includes("(>="));
            expect(versionedToolkit).toEqual([]);
        }
    });
});

describe("gtkx deploy (a build it cannot account for)", () => {
    it("fails when the build metadata is missing", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-deploy-stale-build-",
            config: config(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        expect(runCli(project, ["build"]).status).toBe(0);
        rmSync(join(project.root, "dist", BUILD_METADATA));
        const args = ["deploy", "--print-manifests", "--skip-build", "--target", "deb"];
        expect(() => runCliOrThrow(project, args)).toThrow();
    });
});

describe("gtkx deploy (build metadata it cannot trust)", () => {
    it("fails when the format or a package record is invalid", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-deploy-newer-build-",
            config: config(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        expect(runCli(project, ["build"]).status).toBe(0);
        const metadataPath = join(project.root, "dist", BUILD_METADATA);
        const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as BuildMetadata;
        const args = ["deploy", "--print-manifests", "--skip-build", "--target", "deb"];

        for (const invalid of [
            { ...metadata, formatVersion: metadata.formatVersion + 1 },
            { ...metadata, packages: [{ name: "invalid", version: 1, dir: ".." }] },
        ]) {
            writeFileSync(metadataPath, `${JSON.stringify(invalid, null, 4)}\n`);
            expect(() => runCliOrThrow(project, args)).toThrow();
        }
    });

    it("fails when an in-project schema link escapes the project", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-deploy-schema-escape-",
            config: config(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        const outsideSchema = `${project.root}-outside.gschema.xml`;
        const linkedName = `${APPLICATION_ID}.escaped.gschema.xml`;
        const linkedPath = `data/${linkedName}`;

        try {
            expect(runCli(project, ["build"]).status).toBe(0);
            writeFileSync(outsideSchema, SCHEMA);
            symlinkSync(outsideSchema, join(project.root, "data", linkedName));
            const metadataPath = join(project.root, "dist", BUILD_METADATA);
            const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as BuildMetadata;
            const escapedMetadata = `${JSON.stringify({ ...metadata, schemas: [linkedPath] }, null, 4)}\n`;
            writeFileSync(metadataPath, escapedMetadata);
            const args = ["deploy", "--print-manifests", "--skip-build", "--target", "deb"];
            expect(() => runCliOrThrow(project, args)).toThrow();
        } finally {
            rmSync(outsideSchema, { force: true });
            removeCliProject(project);
        }
    });
});
