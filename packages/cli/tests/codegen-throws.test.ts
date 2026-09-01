import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli } from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.clicodegenthrows";
const FIXTURE_GIR = fileURLToPath(new URL("fixtures/gir", import.meta.url));

const throwingHookConfig = (): string =>
    `export default { applicationId: "${APPLICATION_ID}", ` +
    `libraries: ["ThrowingHook-1.0"], girPath: ${JSON.stringify([FIXTURE_GIR])} };\n`;

const generatedModule = (project: CliProject, ...segments: string[]): string =>
    readFileSync(join(project.nodeModules, ".gtkx", ...segments), "utf8");

const bindingFor = (bindings: string, name: string): string => {
    const start = bindings.indexOf(`const ${name} = `);

    if (start === -1) {
        return "";
    }

    const end = bindings.indexOf("}));", start);

    return bindings.slice(start, end === -1 ? bindings.length : end);
};

describe("gtkx codegen (callbacks whose C signature ends with a GError**)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-throws-",
            config: throwingHookConfig(),
        });

        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("marks a throwing callback parameter with canThrow", () => {
        expect(state.status).toBe(0);
        const bindings = generatedModule(state.project, "gi", "throwinghook", "throwinghook.js");
        const hookBinding = bindingFor(bindings, "throwingHookRunnerSetHook");
        expect(hookBinding).toContain("t.callback(");
        expect(hookBinding).toContain("canThrow: true");
    });

    it("leaves a non-throwing callback parameter without canThrow", () => {
        expect(state.status).toBe(0);
        const bindings = generatedModule(state.project, "gi", "throwinghook", "throwinghook.js");
        const plainBinding = bindingFor(bindings, "throwingHookRunnerSetPlain");
        expect(plainBinding).toContain("t.callback(");
        expect(plainBinding).not.toContain("canThrow");
    });

    it("fails codegen for a library whose GIR file is absent", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-throws-broken-",
            config:
                `export default { applicationId: "${APPLICATION_ID}", ` +
                `libraries: ["ThrowingHookAbsent-1.0"], girPath: ${JSON.stringify([FIXTURE_GIR])} };\n`,
        });

        expect(runCli(project, ["codegen"]).status).not.toBe(0);
    });
});
