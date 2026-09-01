import { existsSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    removeCliProject,
    runCli,
    STORE_LIBRARIES,
} from "./cli-project.js";
import {
    BROKEN_CASES,
    CAIRO_PACKAGE,
    config,
    expectModules,
    expectStoreAndLink,
    fixtureLibrariesConfig,
    generatedModule,
    GI_MODULES,
    initialRunState,
    isStoreMarked,
    JSX_MODULES,
    linkPath,
    markStore,
    resolveCairoFrom,
    runInitialCodegen,
    storeManifest,
    storePath,
    withProject,
} from "./codegen-helpers.js";

describe("gtkx codegen", () => {
    const state = initialRunState();

    beforeAll(() => {
        runInitialCodegen(state, { prefix: "gtkx-cli-codegen-", config: config("") });
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("writes both stores where the project imports them", () => {
        expect(state.status).toBe(0);
        expectStoreAndLink(state.project, "gi", GI_MODULES);
        expectStoreAndLink(state.project, "jsx", JSX_MODULES);
    });

    it("binds cairo through @gtkx/cairo", () => {
        expect(state.status).toBe(0);

        expect(generatedModule(state.project, "gi", "gtk", "gtk.js"))
            .toContain(`import * as cairo from "${CAIRO_PACKAGE}";`);

        expect(storeManifest(state.project, "gi").peerDependencies?.[CAIRO_PACKAGE]).toBe("*");
        expect(storeManifest(state.project, "jsx").peerDependencies?.[CAIRO_PACKAGE]).toBe("*");
        const installed = realpathSync(join(state.project.nodeModules, "@gtkx", "cairo", "package.json"));
        expect(realpathSync(resolveCairoFrom(state.project))).toBe(installed);
    });

    it("leaves a fresh store alone, and restores a link an install pruned", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expect(isStoreMarked(state.project)).toBe(true);
        rmSync(linkPath(state.project, "gi"), { recursive: true, force: true });
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expect(existsSync(linkPath(state.project, "gi", "gtk", "index.js"))).toBe(true);
        expect(isStoreMarked(state.project)).toBe(true);
    });

    it("regenerates a store that lacks the jsx index module", () => {
        rmSync(storePath(state.project, "jsx", "index.js"), { force: true });
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expectModules(storePath(state.project, "jsx"), JSX_MODULES);
    });

    it("rebuilds the store from scratch when it is forced", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen", "--force"]).status).toBe(0);
        expect(isStoreMarked(state.project)).toBe(false);
        expectModules(storePath(state.project, "gi"), GI_MODULES);
        expectModules(storePath(state.project, "jsx"), JSX_MODULES);
    });
});

describe("gtkx codegen (a project that installed the workspace store)", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "" } };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-installed-",
            config: config(`, libraries: ${JSON.stringify(STORE_LIBRARIES)}`),
            hasStore: true,
        });
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("leaves the store it was installed with alone", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expect(isStoreMarked(state.project)).toBe(true);
    });
});

describe("gtkx codegen (a project that generates no store)", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "" } };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-disabled-",
            config: config(`, codegen: false, libraries: ${JSON.stringify(STORE_LIBRARIES)}`),
            hasStore: true,
        });
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("keeps the store the project installed for itself", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expect(isStoreMarked(state.project)).toBe(true);
        expectModules(linkPath(state.project, "gi"), GI_MODULES);
    });

    it("refuses to force a store it does not generate", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen", "--force"]).status).not.toBe(0);
        expect(isStoreMarked(state.project)).toBe(true);
    });
});

describe("gtkx codegen (the libraries a project binds without naming them)", () => {
    it("binds Adwaita alongside Gtk", () => {
        withProject("default-libraries", fixtureLibrariesConfig(undefined), (project) => {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expectModules(storePath(project, "gi"), [join("gtk", "gtk.js"), join("adw", "adw.js")]);
            expectModules(storePath(project, "jsx"), [join("gtk", "gtk.js"), join("adw", "adw.js")]);
        });
    });

    it("adds libraries the project names", () => {
        const source = fixtureLibrariesConfig(["Documented-1.0"]);

        withProject("default-libraries-extra", source, (project) => {
            expect(runCli(project, ["codegen", "--force"]).status).toBe(0);
            expect(existsSync(storePath(project, "gi", "documented"))).toBe(true);
        });
    });

    it("keeps the version of a mandatory namespace that the project pins", () => {
        const source = fixtureLibrariesConfig(["Adw-2"]);

        withProject("default-libraries-pinned", source, (project) => {
            expect(runCli(project, ["codegen", "--force"]).status).toBe(0);
            expect(generatedModule(project, "gi", "adw", "adw.d.ts")).toContain("export declare const Slab");
        });
    });
});

describe("gtkx codegen (projects it cannot generate from)", () => {
    it.each(BROKEN_CASES)("fails over $title", ({ config: body }) => {
        using project = createCliProject({ prefix: "gtkx-cli-codegen-broken-", config: body });

        expect(runCli(project, ["codegen"]).status).not.toBe(0);
        expect(existsSync(storePath(project, "gi"))).toBe(false);
    });
});
