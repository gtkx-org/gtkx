import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    removeCliProject,
    runCli,
    STORE_LIBRARIES,
} from "./cli-project.js";
import { config, isStoreMarked, markStore } from "./codegen-helpers.js";

describe("gtkx codegen (a project that installed the workspace store)", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "", tmpDir: "" } };

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
