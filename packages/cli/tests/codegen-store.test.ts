import { chmodSync, existsSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    removeCliProject,
    runCli,
    STORE_FUTURE,
    STORE_LIBRARIES,
} from "./cli-project.js";
import {
    BROKEN_CASES,
    CAIRO_PACKAGE,
    config,
    expectModules,
    expectStoreAndLink,
    FIXTURE_GIR,
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
    storeLocalCairoLink,
    storeManifest,
    storePath,
    withProject,
    WORKSPACE_CAIRO,
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

    it("binds cairo through @gtkx/cairo and keeps the deprecated @gtkx/gi/cairo alias", () => {
        expect(state.status).toBe(0);
        expect(generatedModule(state.project, "gi", "gtk", "gtk.js")).toContain(`import "${CAIRO_PACKAGE}";`);

        expect(generatedModule(state.project, "gi", "gtk", "gtk.d.ts"))
            .toContain(`import * as cairo from "${CAIRO_PACKAGE}";`);

        expect(generatedModule(state.project, "gi", "cairo", "index.js"))
            .toContain(`export * from "${CAIRO_PACKAGE}";`);

        expect(existsSync(storePath(state.project, "gi", "cairo", "cairo.js"))).toBe(false);
        expect(storeManifest(state.project, "gi").peerDependencies?.[CAIRO_PACKAGE]).toBe("*");
        expect(storeManifest(state.project, "jsx").peerDependencies?.[CAIRO_PACKAGE]).toBe("*");
        const installed = realpathSync(join(state.project.nodeModules, "@gtkx", "cairo", "package.json"));
        expect(realpathSync(resolveCairoFrom(state.project))).toBe(installed);
        expect(existsSync(storeLocalCairoLink(state.project, "gi"))).toBe(false);
        expect(state.output).not.toContain("add @gtkx/cairo to your dependencies");
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

describe("gtkx codegen (a project that does not install @gtkx/cairo)", () => {
    const state = initialRunState();

    beforeAll(() => {
        runInitialCodegen(state, {
            prefix: "gtkx-cli-codegen-nocairo-",
            config: config(""),
            omitPackages: ["cairo"],
        });
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("links the copy @gtkx/codegen depends on into both stores", () => {
        expect(state.status).toBe(0);
        expect(realpathSync(storeLocalCairoLink(state.project, "gi"))).toBe(realpathSync(WORKSPACE_CAIRO));
        expect(realpathSync(storeLocalCairoLink(state.project, "jsx"))).toBe(realpathSync(WORKSPACE_CAIRO));
        expect(realpathSync(resolveCairoFrom(state.project))).toBe(realpathSync(join(WORKSPACE_CAIRO, "package.json")));
        expect(state.output).toContain("add @gtkx/cairo to your dependencies");
    });

    it("fails when the fallback copy cannot be linked into the store", () => {
        const storeModules = storePath(state.project, "gi", "node_modules");
        rmSync(join(storeModules, "@gtkx"), { recursive: true, force: true });
        chmodSync(storeModules, 0o555);

        try {
            expect(runCli(state.project, ["codegen"]).status).not.toBe(0);
        } finally {
            chmodSync(storeModules, 0o755);
        }
    });

    it("keeps the link across runs and drops it once the project installs the package", () => {
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expect(realpathSync(storeLocalCairoLink(state.project, "gi"))).toBe(realpathSync(WORKSPACE_CAIRO));
        symlinkSync(WORKSPACE_CAIRO, join(state.project.nodeModules, "@gtkx", "cairo"), "dir");
        const run = runCli(state.project, ["codegen"]);
        expect(run.status).toBe(0);
        expect(existsSync(storeLocalCairoLink(state.project, "gi"))).toBe(false);
        expect(existsSync(storeLocalCairoLink(state.project, "jsx"))).toBe(false);
        expect(run.output).toContain("is not declared in this project's package.json");
    });
});

describe("gtkx codegen (a project that installed the workspace store)", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "" } };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-installed-",
            config: config(
                `, libraries: ${JSON.stringify(STORE_LIBRARIES)}, future: ${JSON.stringify(STORE_FUTURE)}`,
            ),
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
    it("binds Gtk alone until the project opts into the 2.0 default", () => {
        withProject("default-libraries-off", fixtureLibrariesConfig(undefined, undefined), (project) => {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(existsSync(storePath(project, "gi", "gtk"))).toBe(true);
            expect(existsSync(storePath(project, "gi", "adw"))).toBe(false);
        });
    });

    it("binds Adwaita alongside Gtk once the project opts in", () => {
        withProject("default-libraries-on", fixtureLibrariesConfig(undefined, true), (project) => {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expectModules(storePath(project, "gi"), [join("gtk", "gtk.js"), join("adw", "adw.js")]);
            expectModules(storePath(project, "jsx"), [join("gtk", "gtk.js"), join("adw", "adw.js")]);
        });
    });

    it("deduplicates a library the opted-in default already binds, and says so", () => {
        const source = fixtureLibrariesConfig(["Adw-1", "Documented-1.0"], true);

        withProject("default-libraries-redundant", source, (project) => {
            const run = runCli(project, ["codegen", "--force"]);
            expect(run.status).toBe(0);
            expect(run.output).toContain("codegen: libraries=Gtk-4.0, Adw-1, Documented-1.0");
            expect(run.output).toContain("binds Adw-1 on its own");
            expect(existsSync(storePath(project, "gi", "documented"))).toBe(true);
        });
    });

    it("leaves a library the opted-in default does not already bind alone", () => {
        const source = fixtureLibrariesConfig(["Documented-1.0"], true);

        withProject("default-libraries-extra", source, (project) => {
            const run = runCli(project, ["codegen", "--force"]);
            expect(run.status).toBe(0);
            expect(run.output).toContain("codegen: libraries=Gtk-4.0, Adw-1, Documented-1.0");
            expect(run.output).not.toContain("on its own");
        });
    });

    it("keeps the version of a mandatory namespace that the project pins", () => {
        const source = fixtureLibrariesConfig(["Adw-2"], true);

        withProject("default-libraries-pinned", source, (project) => {
            const run = runCli(project, ["codegen", "--force"]);
            expect(run.status).toBe(0);
            expect(run.output).toContain("codegen: libraries=Gtk-4.0, Adw-2");
            expect(run.output).not.toContain("on its own");
            expect(generatedModule(project, "gi", "adw", "adw.d.ts")).toContain("declare class Slab");
        });
    });
});

describe("gtkx codegen (library settings that invalidate the store)", () => {
    it("regenerates a fresh store when the default library setting changes", () => {
        withProject("default-libraries-flip", fixtureLibrariesConfig(undefined, undefined), (project) => {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            markStore(project);
            writeFileSync(join(project.root, "gtkx.config.ts"), fixtureLibrariesConfig(undefined, true));
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(isStoreMarked(project)).toBe(false);
            expect(existsSync(storePath(project, "gi", "adw"))).toBe(true);
        });
    });

    it("reports that binding every installed library is going away", () => {
        withProject("wildcard-libraries", config(', libraries: "*", codegen: false'), (project) => {
            const run = runCli(project, ["codegen"]);
            expect(run.status).toBe(0);
            expect(run.output).toContain("list the libraries the project needs");
        });
    });

    it("says nothing about the wildcard when the project lists its libraries", () => {
        withProject("explicit-libraries", config(', libraries: ["Gtk-4.0"], codegen: false'), (project) => {
            const run = runCli(project, ["codegen"]);
            expect(run.status).toBe(0);
            expect(run.output).not.toContain("list the libraries the project needs");
        });
    });
});

describe("gtkx codegen (a future key the schema does not know)", () => {
    it("generates anyway, and reports that the key is ignored", () => {
        const source = config(`, girPath: ${JSON.stringify([FIXTURE_GIR])}, future: { v2ByteArrrays: true }`);

        withProject("unknown-future", source, (project) => {
            const run = runCli(project, ["codegen"]);
            expect(run.status).toBe(0);
            expect(run.output).toContain("v2ByteArrrays");
        });
    });
});

describe("gtkx codegen (a project that does not declare itself a module)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-commonjs-",
            config: config(""),
            packageType: "commonjs",
        });

        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("writes stores that are still ECMAScript modules", () => {
        expect(state.status).toBe(0);
        expect(generatedModule(state.project, "jsx", "metadata.js")).not.toContain("__esModule");
        expect(generatedModule(state.project, "gi", "gtk", "gtk.js")).not.toContain("__esModule");
    });
});

describe("gtkx codegen (projects it cannot generate from)", () => {
    it.each(BROKEN_CASES)("fails over $title", ({ config: body }) => {
        const project = createCliProject({ prefix: "gtkx-cli-codegen-broken-", config: body });

        try {
            expect(runCli(project, ["codegen"]).status).not.toBe(0);
            expect(existsSync(storePath(project, "gi"))).toBe(false);
        } finally {
            removeCliProject(project);
        }
    });
});
