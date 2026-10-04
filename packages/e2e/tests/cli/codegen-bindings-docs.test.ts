import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli } from "./cli-project.js";
import {
    COMMENT,
    DOCUMENTED_MODULE_CASES,
    fixtureConfig,
    generatedModule,
    HOVER_CASES,
    HOVER_PROBE,
    hoverDoc,
    PURE,
} from "./codegen-helpers.js";

const MISSING_GIR_CONFIG =
    `export default { applicationId: "com.gtkx.clicodegen", libraries: ${JSON.stringify(["Documented-1.0"])}, ` +
    `girPath: ${JSON.stringify(["/nonexistent"])} };\n`;
describe("gtkx codegen (where the documentation goes)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "", tmpDir: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-docs-",
            config: fixtureConfig("Documented-1.0"),
            files: { "src/probe.tsx": HOVER_PROBE },
        });

        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it.each(DOCUMENTED_MODULE_CASES)(
        "documents $title in its declaration alone",
        ({ store, stem, docs, stripped }) => {
            expect(state.status).toBe(0);
            const declared = generatedModule(state.project, store, `${stem}.d.ts`);
            expect(docs.filter((text) => !declared.includes(text))).toEqual([]);
            expect(stripped.filter((text) => declared.includes(text))).toEqual([]);
            const emitted = generatedModule(state.project, store, `${stem}.js`).split(PURE).join("");
            expect(emitted).not.toMatch(COMMENT);
        },
    );

    it.each(HOVER_CASES)("surfaces the documentation of $title on hover", ({ text, doc, omits }) => {
        expect(state.status).toBe(0);
        const hover = hoverDoc(state.project, join("src", "probe.tsx"), text);
        expect(hover).toContain(doc);
        expect(omits.filter((entry) => hover.includes(entry))).toEqual([]);
    });

    it("fails when the documented library has no GIR file on the search path", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-docs-missing-",
            config: MISSING_GIR_CONFIG,
        });

        expect(runCli(project, ["codegen"]).status).not.toBe(0);
    });
});
