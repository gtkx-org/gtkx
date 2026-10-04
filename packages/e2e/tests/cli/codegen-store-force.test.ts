import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "./cli-project.js";
import { expectModules, GI_MODULES, isStoreMarked, JSX_MODULES, markStore, storePath } from "./codegen-helpers.js";
import { createCodegenStoreHarness } from "./codegen-store-fixture.js";

describe("gtkx codegen (a forced store rebuild)", () => {
    const { state, setup, cleanup } = createCodegenStoreHarness();
    beforeAll(setup);
    afterAll(cleanup);

    it("rebuilds the store from scratch", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen", "--force"]).status).toBe(0);
        expect(isStoreMarked(state.project)).toBe(false);
        expectModules(storePath(state.project, "gi"), GI_MODULES);
        expectModules(storePath(state.project, "jsx"), JSX_MODULES);
    });
});
