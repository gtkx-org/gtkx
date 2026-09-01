import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli } from "./cli-project.js";
import {
    APPLICATION_STANZA,
    bareFiles,
    BINARY_NAME,
    BUILD_METADATA,
    type BuildMetadata,
    BUNDLE_STANZA,
    config,
    COPYRIGHT_FORMAT,
    COPYRIGHT_PATH,
    DEPENDENCY_NAME,
    DEPENDENCY_SECTION,
    DEPENDENCY_VERSION,
    DEPLOY_BLOCK,
    deployProbe,
    GTKX_SOURCE,
    MIT_SENTENCE,
    NATIVE_STANZA,
    NODE_LICENSE_TEXT,
    NODE_STANZA,
    NOTICE_TARGETS,
    NOTICES_BLOCK,
    NOTICES_HEADING,
    noticesFiles,
    noticesFor,
    outputFile,
    outputNames,
    OWN_LICENSE_TEXT,
    PLATFORM_LIBRARY,
    PLATFORM_SECTION,
    PLATFORM_SOURCE,
    STAGE_PREFIX,
    stanzaFor,
    strangeRuntimeFiles,
    TARGETS,
    UNDECLARED_LICENSE,
} from "./deploy-helpers.js";

describe("gtkx deploy (third-party notices)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-deploy-notices-",
        config: config(NOTICES_BLOCK),
        files: noticesFiles(),
        args: ["deploy", "--print-manifests", "--target", TARGETS],
    });

    it("writes a machine-readable copyright with a stanza for everything the package carries", () => {
        const copyright = outputFile(state.project, COPYRIGHT_PATH);
        expect(state.status).toBe(0);
        expect(copyright).toContain(COPYRIGHT_FORMAT);
        expect(copyright).toContain(NODE_STANZA);
        expect(copyright).toContain(NATIVE_STANZA);
        expect(copyright).toContain(BUNDLE_STANZA);
        expect(copyright).toContain(GTKX_SOURCE);
        expect(copyright).toContain(MIT_SENTENCE);
        expect(copyright).toContain(PLATFORM_LIBRARY);
    });

    it("installs the notices on every target that carries no copyright file", () => {
        for (const target of NOTICE_TARGETS) {
            const notices = noticesFor(state.project, target);
            expect(notices).toContain(NOTICES_HEADING);
            expect(notices).toContain(MIT_SENTENCE);
            expect(notices).toContain(PLATFORM_SECTION);
            expect(notices).toContain(PLATFORM_SOURCE);
        }
    });

    it("keeps the unified build metadata it collects notices from out of the package", () => {
        const staged = outputNames(state.project);
        expect(staged).not.toContain(join(STAGE_PREFIX, "lib", BINARY_NAME, BUILD_METADATA));
        expect(staged).toContain(join(STAGE_PREFIX, "lib", BINARY_NAME, "bundle.mjs"));
    });

    it("carries the license of the runtime it is pointed at", () => {
        expect(outputFile(state.project, COPYRIGHT_PATH)).toContain(NODE_LICENSE_TEXT);
        expect(noticesFor(state.project, "rpm")).toContain(NODE_LICENSE_TEXT);
    });

    it("lists a bundled dependency that declares no license at all", () => {
        const notices = noticesFor(state.project, "rpm");
        expect(notices).toContain(`${DEPENDENCY_NAME} ${DEPENDENCY_VERSION}`);
        expect(notices).toContain(UNDECLARED_LICENSE);
    });

    it("keeps the application's own terms on the file its own code is compiled into", () => {
        const bundle = stanzaFor(outputFile(state.project, COPYRIGHT_PATH), BUNDLE_STANZA.replace("Files: ", ""));
        expect(bundle).toContain(APPLICATION_STANZA);
        expect(bundle).toContain(`${DEPENDENCY_NAME} ${DEPENDENCY_VERSION}`);
    });
});

describe("gtkx deploy (a runtime with a license of its own)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-deploy-strange-runtime-",
        config: config(NOTICES_BLOCK),
        files: strangeRuntimeFiles(),
        args: ["deploy", "--print-manifests", "--target", "rpm"],
    });

    it("publishes no license beside the runtime that is not the runtime's", () => {
        expect(state.status).toBe(0);
        expect(noticesFor(state.project, "rpm")).not.toContain(OWN_LICENSE_TEXT);
    });
});

describe("gtkx deploy (a bundle with nothing third-party in it)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-deploy-bare-bundle-",
        config: config(DEPLOY_BLOCK),
        files: bareFiles(),
        args: ["deploy", "--print-manifests", "--target", "rpm"],
    });

    it("leaves out the dependency section rather than heading an empty one", () => {
        expect(state.status).toBe(0);
        expect(noticesFor(state.project, "rpm")).not.toContain(DEPENDENCY_SECTION);
    });

    it("accepts build metadata with no schema sources", () => {
        const path = join(state.project.root, "dist", BUILD_METADATA);
        const metadata = JSON.parse(readFileSync(path, "utf8")) as BuildMetadata;
        expect(state.status).toBe(0);
        expect(metadata.schemas).toEqual([]);
    });
});

describe("gtkx deploy (a build whose packages have moved)", () => {
    it("still names a dependency whose recorded directory is gone", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-deploy-moved-",
            config: config(NOTICES_BLOCK),
            files: noticesFiles(),
            hasStore: true,
        });

        expect(runCli(project, ["build"]).status).toBe(0);
        rmSync(join(project.root, "node_modules", DEPENDENCY_NAME), { recursive: true, force: true });
        const args = ["deploy", "--print-manifests", "--skip-build", "--target", "rpm"];
        expect(runCli(project, args).status).toBe(0);
        expect(noticesFor(project, "rpm")).toContain(`${DEPENDENCY_NAME} ${DEPENDENCY_VERSION}`);
    });
});
