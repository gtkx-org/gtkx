import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli, runCliOrThrow } from "./cli-project.js";
import {
    APPLICATION_ID,
    BAD_MODE_BLOCK,
    config,
    DEFAULT_CLEANUP,
    DEFAULT_FINISH_ARGS,
    DEPLOY_BLOCK,
    deployProbe,
    EXPECTED_MANIFESTS,
    EXPECTED_STAGED,
    expectUnlocalizedMetadata,
    flatpakManifest,
    HELPER_DESTINATION,
    HELPER_PACKAGE_PATH,
    HELPER_SOURCE,
    MERGED_NEGATIONS,
    MINIMUMS_BLOCK,
    NFPM_PATH,
    NO_DISPLAY_BLOCK,
    NOTES_DESTINATION,
    OUT_DIR,
    outputNames,
    packagedDepends,
    packagedMode,
    projectFiles,
    RPM_NFPM_PATH,
    SECRET_DESTINATION,
    SOURCE_ARGS,
    STAGE_PREFIX,
    stagedMode,
    TARGETS,
} from "./deploy-helpers.js";

describe("gtkx deploy (manifests only)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-deploy-",
        config: config(DEPLOY_BLOCK),
        files: projectFiles(),
        args: ["deploy", "--print-manifests", "--target", TARGETS],
        executables: [HELPER_SOURCE],
    });

    it("writes the freedesktop metadata and a manifest per target", () => {
        const written = outputNames(state.project);
        expect(state.status).toBe(0);
        expect(EXPECTED_MANIFESTS.filter((name) => !written.includes(name))).toEqual([]);
    });

    it("stages the built application beside them", () => {
        const staged = new Set(outputNames(state.project).filter((name) => name.startsWith(STAGE_PREFIX)));
        expect(EXPECTED_STAGED.filter((name) => !staged.has(name))).toEqual([]);
    });

    it("installs an extra file with the mode it has and the mode it was given", () => {
        expect(state.status).toBe(0);
        expect(stagedMode(state.project, HELPER_DESTINATION)).toBe(0o755);
        expect(stagedMode(state.project, NOTES_DESTINATION)).toBe(0o644);
        expect(stagedMode(state.project, SECRET_DESTINATION)).toBe(0o600);
        expect(packagedMode(state.project, HELPER_PACKAGE_PATH)).toBe(0o755);
    });

    it("merges the configured finish-args and cleanup into the defaults", () => {
        const manifest = flatpakManifest(state.project);
        expect(manifest["finish-args"]).toEqual([...DEFAULT_FINISH_ARGS, "--share=network"]);
        expect(manifest.cleanup).toEqual([...DEFAULT_CLEANUP, "/man"]);
    });

    it("names the toolkit packages with no minimum version of their own", () => {
        const depends = packagedDepends(state.project, NFPM_PATH);
        expect(depends).toEqual(expect.arrayContaining(["libgtk-4-1", "libadwaita-1-0"]));
        expect(depends.filter((entry) => entry.startsWith("libgtk-4-1 ("))).toEqual([]);
        expect(packagedDepends(state.project, RPM_NFPM_PATH)).toEqual(expect.arrayContaining(["gtk4", "libadwaita"]));
    });

    it("leaves the relations that carry no release of their own alone", () => {
        expect(packagedDepends(state.project, NFPM_PATH)).toContain("hicolor-icon-theme");
        expect(packagedDepends(state.project, RPM_NFPM_PATH)).toContain("libGLESv2.so.2()(64bit)");
    });

    it("leaves metadata untranslated when the project has no po directory", () => {
        expectUnlocalizedMetadata(state.project);
    });
});

describe("gtkx deploy (application icon selection)", () => {
    it("packages an application-id icon in the project root by default", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-deploy-default-icon-",
            config: config(DEPLOY_BLOCK, null),
            files: { ...projectFiles(), [`${APPLICATION_ID}.svg`]: "<svg/>\n" },
            hasStore: true,
        });

        expect(runCli(project, ["deploy", "--print-manifests", "--target", "deb"]).status).toBe(0);

        expect(outputNames(project)).toContain(
            join(STAGE_PREFIX, "share", "icons", "hicolor", "scalable", "apps", `${APPLICATION_ID}.svg`),
        );
    });

    it("preserves scaled and symbolic files in a configured hicolor theme", () => {
        const scaled = join("hicolor", "128x128@2", "apps", `${APPLICATION_ID}.png`);
        const symbolic = join("hicolor", "symbolic", "apps", `${APPLICATION_ID}-symbolic.svg`);

        using project = createCliProject({
            prefix: "gtkx-cli-deploy-icon-variants-",
            config: config(DEPLOY_BLOCK, "data/variant-icons"),
            files: {
                ...projectFiles(),
                [join("data", "variant-icons", scaled)]: "png\n",
                [join("data", "variant-icons", symbolic)]: "<svg/>\n",
            },
            hasStore: true,
        });

        expect(runCli(project, ["deploy", "--print-manifests", "--target", "deb"]).status).toBe(0);

        expect(outputNames(project)).toEqual(expect.arrayContaining([
            join(STAGE_PREFIX, "share", "icons", scaled),
            join(STAGE_PREFIX, "share", "icons", symbolic),
        ]));
    });
});

describe("gtkx deploy (invalid application icon themes)", () => {
    it("fails when the project provides no application icon", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-deploy-missing-icon-",
            config: config(DEPLOY_BLOCK, null),
            files: projectFiles(),
            hasStore: true,
        });

        expect(() => runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "deb"])).toThrow();
    });

    it("fails when the application icon is outside a usable icon-theme layout", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-deploy-malformed-icon-theme-",
            config: config(DEPLOY_BLOCK, "data/malformed-icons"),
            files: {
                ...projectFiles(),
                [join("data", "malformed-icons", "random", `${APPLICATION_ID}.svg`)]: "<svg/>\n",
            },
            hasStore: true,
        });

        expect(() => runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "deb"])).toThrow();
    });
});

describe("gtkx deploy (minimum library versions the project sets itself)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-minimums-",
        config: config(MINIMUMS_BLOCK),
        files: projectFiles(),
        args: ["deploy", "--print-manifests", "--target", "deb,rpm"],
    });

    it("uses the minimum the project declares", () => {
        expect(state.status).toBe(0);
        expect(packagedDepends(state.project, NFPM_PATH)).toContain("libgtk-4-1 (>= 4.14)");
        expect(packagedDepends(state.project, RPM_NFPM_PATH)).toContain("gtk4 >= 4.14");
    });
});

describe("gtkx deploy (flatpak defaults a config drops)", () => {
    it("drops the sockets it negates and the cleanup it empties, keeping every other default", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-deploy-sockets-",
            config: config(NO_DISPLAY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        expect(runCli(project, SOURCE_ARGS).status).toBe(0);
        const manifest = flatpakManifest(project);
        expect(manifest["finish-args"]).toEqual(MERGED_NEGATIONS);
        expect(manifest.cleanup).toEqual([]);
    });
});

describe("gtkx deploy (projects it refuses to package)", () => {
    it("fails when the configuration declares nothing to deploy", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-deploy-bare-",
            config: config(""),
            files: projectFiles(),
            hasStore: true,
        });

        expect(runCli(project, ["deploy", "--print-manifests"]).status).not.toBe(0);
        expect(existsSync(join(project.root, OUT_DIR))).toBe(false);
    });

    it("fails over an extra file mode that is not octal", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-deploy-mode-",
            config: config(BAD_MODE_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        expect(runCli(project, ["deploy", "--print-manifests"]).status).not.toBe(0);
    });

    it("fails over a target it does not know", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-deploy-target-",
            config: config(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        expect(runCli(project, ["deploy", "--print-manifests", "--target", "snap"]).status).not.toBe(0);
        expect(existsSync(join(project.root, OUT_DIR))).toBe(false);
    });
});
