import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "./cli-project.js";
import { expectModules, GI_MODULES, storePath } from "./codegen-helpers.js";
import { createCodegenStoreHarness } from "./codegen-store-fixture.js";

describe("gtkx codegen (an incomplete GI store)", () => {
    const { state, setup, cleanup } = createCodegenStoreHarness();
    beforeAll(setup);
    afterAll(cleanup);

    it("regenerates a missing namespace declaration", () => {
        rmSync(storePath(state.project, "gi", "gobject", "index.d.ts"), { force: true });
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expectModules(storePath(state.project, "gi"), GI_MODULES);
    });
});
