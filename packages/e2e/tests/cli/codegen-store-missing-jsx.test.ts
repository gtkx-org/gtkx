import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "./cli-project.js";
import { expectModules, JSX_MODULES, storePath } from "./codegen-helpers.js";
import { createCodegenStoreHarness } from "./codegen-store-fixture.js";

describe("gtkx codegen (an incomplete JSX store)", () => {
    const { state, setup, cleanup } = createCodegenStoreHarness();
    beforeAll(setup);
    afterAll(cleanup);

    it("regenerates a missing namespace module", () => {
        rmSync(storePath(state.project, "jsx", "adw", "adw.js"), { force: true });
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expectModules(storePath(state.project, "jsx"), JSX_MODULES);
    });
});
