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
    defaultLibrariesConfig,
    DEPLOY_BLOCK,
    type DeployRun,
    FOREIGN_INVENTORY,
    LIBRARIES_INVENTORY,
    NFPM_PATH,
    optedOutConfig,
    packagedDepends,
    projectFiles,
    SCHEMA,
    wildcardConfig,
} from "./deploy-helpers.js";

describe("gtkx deploy (a store whose inventory is not shaped like one)", () => {
    const project: CliProject = { root: "", nodeModules: "" };
    let status: number | null = null;

    beforeAll(() => {
        const created = createCliProject({
            prefix: "gtkx-cli-foreign-",
            config: optedOutConfig(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        project.root = created.root;
        project.nodeModules = created.nodeModules;
        runCli(project, ["deploy", "--print-manifests", "--target", "deb"]);
        writeFileSync(join(project.root, LIBRARIES_INVENTORY), FOREIGN_INVENTORY);
        status = runCli(project, ["deploy", "--print-manifests", "--skip-build", "--target", "deb"]).status;
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("falls back to the library it generates by default", () => {
        expect(status).toBe(0);
        expect(packagedDepends(project, NFPM_PATH)).toContain("libgtk-4-1");
    });

    it("declares nothing the foreign inventory named", () => {
        expect(packagedDepends(project, NFPM_PATH)).not.toContain("libadwaita-1-0");
    });
});

describe("gtkx deploy (a project that opts into the 2.0 default libraries)", () => {
    const project: CliProject = { root: "", nodeModules: "" };
    let status: number | null = null;

    beforeAll(() => {
        const created = createCliProject({
            prefix: "gtkx-cli-default-libraries-",
            config: bareConfig(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        project.root = created.root;
        project.nodeModules = created.nodeModules;
        runCli(project, ["deploy", "--print-manifests", "--target", "deb"]);
        writeFileSync(join(project.root, LIBRARIES_INVENTORY), FOREIGN_INVENTORY);
        writeFileSync(join(project.root, "gtkx.config.ts"), defaultLibrariesConfig(DEPLOY_BLOCK));
        status = runCli(project, ["deploy", "--print-manifests", "--skip-build", "--target", "deb"]).status;
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("declares Adwaita alongside Gtk without the project naming either", () => {
        expect(status).toBe(0);
        expect(packagedDepends(project, NFPM_PATH)).toContain("libgtk-4-1");
        expect(packagedDepends(project, NFPM_PATH)).toContain("libadwaita-1-0");
    });
});

describe("gtkx deploy (a store that recorded no libraries)", () => {
    const project: CliProject = { root: "", nodeModules: "" };
    let status: number | null = null;

    beforeAll(() => {
        const created = createCliProject({
            prefix: "gtkx-cli-unrecorded-",
            config: bareConfig(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        project.root = created.root;
        project.nodeModules = created.nodeModules;
        runCli(project, ["deploy", "--print-manifests", "--target", "deb"]);
        rmSync(join(project.root, LIBRARIES_INVENTORY), { force: true });
        status = runCli(project, ["deploy", "--print-manifests", "--skip-build", "--target", "deb"]).status;
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("still declares the library it generates by default", () => {
        expect(status).toBe(0);
        expect(packagedDepends(project, NFPM_PATH)).toContain("libgtk-4-1");
    });

    it("declares no minimum it could not determine", () => {
        expect(packagedDepends(project, NFPM_PATH).filter((entry) => entry.includes("(>="))).toEqual([]);
    });
});

describe("gtkx deploy (a project that binds whatever the build host installed)", () => {
    const project: CliProject = { root: "", nodeModules: "" };
    const state: DeployRun = { status: null, output: "" };

    beforeAll(() => {
        const created = createCliProject({
            prefix: "gtkx-cli-wildcard-",
            config: config(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        project.root = created.root;
        project.nodeModules = created.nodeModules;
        runCli(project, ["build"]);
        writeFileSync(join(project.root, "gtkx.config.ts"), wildcardConfig(DEPLOY_BLOCK));
        const run = runCli(project, ["deploy", "--print-manifests", "--skip-build", "--target", "deb"]);
        state.status = run.status;
        state.output = run.output;
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("keeps declaring the relations of everything its store bound", () => {
        expect(state.status).toBe(0);
        expect(packagedDepends(project, NFPM_PATH).filter((entry) => entry.startsWith("libgtk-4-1"))).toHaveLength(1);
    });
});

describe("gtkx deploy (a build it cannot account for)", () => {
    it("fails when the build metadata is missing", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-deploy-stale-build-",
            config: config(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        try {
            expect(runCli(project, ["build"]).status).toBe(0);
            rmSync(join(project.root, "dist", BUILD_METADATA));
            const args = ["deploy", "--print-manifests", "--skip-build", "--target", "deb"];
            expect(() => runCliOrThrow(project, args)).toThrow();
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx deploy (build metadata it cannot trust)", () => {
    it("fails when the format or a package record is invalid", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-deploy-newer-build-",
            config: config(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        try {
            expect(runCli(project, ["build"]).status).toBe(0);
            const metadataPath = join(project.root, "dist", BUILD_METADATA);
            const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as BuildMetadata;
            const args = ["deploy", "--print-manifests", "--skip-build", "--target", "deb"];

            for (const invalid of [
                { ...metadata, formatVersion: 2 },
                { ...metadata, packages: [{ name: "invalid", version: 1, dir: ".." }] },
            ]) {
                writeFileSync(metadataPath, `${JSON.stringify(invalid, null, 4)}\n`);
                expect(() => runCliOrThrow(project, args)).toThrow();
            }
        } finally {
            removeCliProject(project);
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
