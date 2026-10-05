import { existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "./cli-project.js";
import {
    CAIRO_PACKAGE,
    expectStoreAndLink,
    generatedModule,
    GI_MODULES,
    isStoreMarked,
    JSX_MODULES,
    linkPath,
    markStore,
    resolveCairoFrom,
    storeManifest,
    storePath,
} from "./codegen-helpers.js";
import { createCodegenStoreHarness } from "./codegen-store-fixture.js";

describe("gtkx codegen", () => {
    const { state, setup, cleanup } = createCodegenStoreHarness();

    beforeAll(setup);
    afterAll(cleanup);

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

    it("records only the GIR library identifiers", () => {
        const inventory = JSON.parse(
            readFileSync(storePath(state.project, "gi", "libraries.json"), "utf8"),
        ) as Record<string, unknown>;

        expect(Object.keys(inventory)).toEqual(["libraries"]);
        expect(inventory.libraries).toEqual(["Adw-1", "Gtk-4.0"]);
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
});
