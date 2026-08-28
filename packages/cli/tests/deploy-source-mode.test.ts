import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, initGitRepo, removeCliProject, runCli } from "./cli-project.js";
import {
    APPEND_PATH,
    COMMIT_PATTERN,
    deployProbe,
    expectRefusal,
    findInlineSource,
    findSource,
    flatpakModule,
    GENERATED_SOURCES,
    HELPER_DESTINATION,
    HELPER_INSTALL,
    HELPER_SCRIPT,
    HELPER_SOURCE,
    LICENSE_INSTALL,
    MIME_FILENAME,
    MIME_INSTALL,
    MIME_TYPE,
    NODE_EXTENSION_PATH,
    NOTICES_FILENAME,
    NOTICES_HEADING,
    NOTICES_INSTALL,
    NPM_INSTALL,
    npmSourceFiles,
    outputNames,
    PINNED_SOURCE,
    PNPM_INSTALL,
    PNPM_PIN,
    PNPM_SHA512,
    PNPM_TARBALL,
    PNPM_VERSION,
    SCHEMA_INSTALL,
    SOURCE_ARGS,
    SOURCE_PAYLOAD,
    SOURCE_TAG,
    sourceConfig,
    sourceFiles,
    stubGenerator,
    TAGGED_SOURCE,
} from "./deploy-helpers.js";

describe("gtkx deploy (flatpak source mode)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-deploy-source-",
        config: sourceConfig(PINNED_SOURCE),
        files: sourceFiles(PNPM_PIN),
        args: SOURCE_ARGS,
    });

    it("vendors a hash-pinned pnpm beside the offline sources", () => {
        const appModule = flatpakModule(state.project);
        const archive = findSource(appModule, "archive");
        expect(state.status).toBe(0);
        expect(outputNames(state.project)).toContain(GENERATED_SOURCES);
        expect(archive?.url).toContain(PNPM_TARBALL);
        expect(archive?.sha512).toBe(PNPM_SHA512);
        expect(findSource(appModule, "script")?.["dest-filename"]).toBe("pnpm");
        expect(appModule["build-options"]["append-path"]).toBe(APPEND_PATH);
        expect(appModule["build-commands"][0]).toBe(PNPM_INSTALL);
        expect(Object.keys(appModule["build-options"].env)).toEqual(["npm_config_nodedir"]);
    });
});

describe("gtkx deploy (flatpak source mode without pnpm)", () => {
    it("renders an npm manifest with a generator that cannot vendor pnpm", () => {
        const shim = stubGenerator();

        const project = createCliProject({
            prefix: "gtkx-cli-deploy-npm-",
            config: sourceConfig(PINNED_SOURCE),
            files: npmSourceFiles(),
            hasStore: true,
        });

        try {
            const env = { PATH: `${shim}:${process.env.PATH ?? ""}` };
            expect(runCli(project, SOURCE_ARGS, env).status).toBe(0);
            const appModule = flatpakModule(project);
            expect(appModule["build-commands"][0]).toBe(NPM_INSTALL);
            expect(appModule["build-options"]["append-path"]).toBe(NODE_EXTENSION_PATH);
            expect(findSource(appModule, "archive")).toBeUndefined();
        } finally {
            removeCliProject(project);
            rmSync(shim, { recursive: true, force: true });
        }
    });
});

describe("gtkx deploy (flatpak source mode payload)", () => {
    it("installs the extra files, the MIME package, the license, and the third-party notices", () => {
        const shim = stubGenerator();

        const project = createCliProject({
            prefix: "gtkx-cli-deploy-payload-",
            config: sourceConfig(PINNED_SOURCE, SOURCE_PAYLOAD),
            files: npmSourceFiles(),
            hasStore: true,
        });

        try {
            chmodSync(join(project.root, HELPER_SOURCE), 0o755);
            const env = { PATH: `${shim}:${process.env.PATH ?? ""}` };
            expect(runCli(project, SOURCE_ARGS, env).status).toBe(0);
            const appModule = flatpakModule(project);
            expect(findInlineSource(appModule, MIME_FILENAME)?.contents).toContain(MIME_TYPE);
            expect(appModule["build-commands"]).toContain(MIME_INSTALL);
            expect(appModule["build-commands"]).toContain(HELPER_INSTALL);
            expect(appModule["build-commands"]).toContain(LICENSE_INSTALL);
            expect(appModule["build-commands"]).toContain(SCHEMA_INSTALL);
            expect(appModule["build-commands"]).toContain(NOTICES_INSTALL);
            expect(findInlineSource(appModule, NOTICES_FILENAME)?.contents).toContain(NOTICES_HEADING);
        } finally {
            removeCliProject(project);
            rmSync(shim, { recursive: true, force: true });
        }
    });
});

describe("gtkx deploy (flatpak source mode escapes)", () => {
    it("fails when an extra file is a symlink pointing outside the checkout", () => {
        const shim = stubGenerator();
        const outside = mkdtempSync(join(tmpdir(), "gtkx-cli-deploy-linked-"));
        const target = join(outside, "helper.sh");
        writeFileSync(target, HELPER_SCRIPT);
        const extra = `        extraFiles: { "${HELPER_DESTINATION}": "helper.sh" },\n`;

        const project = createCliProject({
            prefix: "gtkx-cli-deploy-symlink-",
            config: sourceConfig(PINNED_SOURCE, extra),
            files: npmSourceFiles(),
            hasStore: true,
        });

        try {
            symlinkSync(target, join(project.root, "helper.sh"));
            const env = { PATH: `${shim}:${process.env.PATH ?? ""}` };
            expect(runCli(project, SOURCE_ARGS, env).status).not.toBe(0);
        } finally {
            removeCliProject(project);
            rmSync(outside, { recursive: true, force: true });
            rmSync(shim, { recursive: true, force: true });
        }
    });

    it("fails when an extra file lives outside the checkout it builds from", () => {
        const shim = stubGenerator();
        const outside = mkdtempSync(join(tmpdir(), "gtkx-cli-deploy-outside-"));
        const source = join(outside, "helper.sh");
        writeFileSync(source, HELPER_SCRIPT);
        const extra = `        extraFiles: { "${HELPER_DESTINATION}": ${JSON.stringify(source)} },\n`;

        const project = createCliProject({
            prefix: "gtkx-cli-deploy-escape-",
            config: sourceConfig(PINNED_SOURCE, extra),
            files: npmSourceFiles(),
            hasStore: true,
        });

        try {
            const env = { PATH: `${shim}:${process.env.PATH ?? ""}` };
            expect(runCli(project, SOURCE_ARGS, env).status).not.toBe(0);
        } finally {
            removeCliProject(project);
            rmSync(outside, { recursive: true, force: true });
            rmSync(shim, { recursive: true, force: true });
        }
    });
});

describe("gtkx deploy (flatpak source revisions)", () => {
    it("pins the commit behind a configured tag", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-deploy-tag-",
            config: sourceConfig(TAGGED_SOURCE),
            files: sourceFiles(PNPM_PIN),
            hasStore: true,
        });

        try {
            initGitRepo(project, SOURCE_TAG);
            expect(runCli(project, SOURCE_ARGS).status).toBe(0);
            const git = findSource(flatpakModule(project), "git");
            expect(git?.tag).toBe(SOURCE_TAG);
            expect(git?.commit).toMatch(COMMIT_PATTERN);
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx deploy (Flathub sources it refuses)", () => {
    it("fails when the pinned pnpm carries no integrity digest", () => {
        expectRefusal("gtkx-cli-deploy-unpinned-", PINNED_SOURCE, `pnpm@${PNPM_VERSION}`);
    });

    it("fails when the pinned pnpm cannot install offline", () => {
        expectRefusal("gtkx-cli-deploy-untrusted-", PINNED_SOURCE, `pnpm@11.2.2+sha512.${PNPM_SHA512}`);
    });

    it("fails when the configured tag resolves to no commit", () => {
        expectRefusal("gtkx-cli-deploy-untagged-", TAGGED_SOURCE, PNPM_PIN);
    });

    it("fails when the installed flatpak-node-generator cannot vendor pnpm", () => {
        const shim = stubGenerator();

        try {
            expectRefusal("gtkx-cli-deploy-stale-", PINNED_SOURCE, PNPM_PIN, {
                PATH: `${shim}:${process.env.PATH ?? ""}`,
            });
        } finally {
            rmSync(shim, { recursive: true, force: true });
        }
    });
});
