import { readFileSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "./cli-project.js";
import { storePath } from "./codegen-helpers.js";
import { createCodegenStoreHarness } from "./codegen-store-fixture.js";

describe("gtkx codegen (an incomplete store manifest)", () => {
    const { state, setup, cleanup } = createCodegenStoreHarness();
    beforeAll(setup);
    afterAll(cleanup);

    it("restores a missing namespace export", () => {
        const manifestPath = storePath(state.project, "gi", "package.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { exports?: Record<string, unknown> };

        if (manifest.exports === undefined) {
            throw new Error("generated GI store has no exports");
        }

        delete manifest.exports["./gtk"];
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        const restored = JSON.parse(readFileSync(manifestPath, "utf8")) as { exports?: Record<string, unknown> };
        expect(restored.exports).toHaveProperty("./gtk");
    });
});
