import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli } from "./cli-project.js";
import { fixtureLibrariesConfig } from "./codegen-helpers.js";

const CONFIG = `import { applicationId } from "./config-value.mjs";

export default async () => {
    globalThis.configGate.started();
    await globalThis.configGate.released;

    if (globalThis.configGate.shouldFail) throw new Error();

    return { applicationId, codegen: false };
};
`;

const PROBE = String.raw`import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { loadConfig } from "@gtkx/config";

const before = await import("./singleton.mjs");
const shouldFail = process.argv[2] === "failure";

async function load(applicationId, shouldFail) {
    writeFileSync(new URL("./config-value.mjs", import.meta.url),
        "export const applicationId = " + JSON.stringify(applicationId) + ";\n");
    const { promise: started, resolve: signalStarted } = Promise.withResolvers();
    const { promise: released, resolve: release } = Promise.withResolvers();
    globalThis.configGate = { started: signalStarted, released, shouldFail };
    const loading = loadConfig(import.meta.dirname, { configFile: "gtkx.config.mjs" });
    const completed = shouldFail
        ? assert.rejects(loading)
        : loading.then(({ config }) => assert.equal(config.applicationId, applicationId));
    await started;

    try {
        const during = await import("./singleton.mjs");
        assert.equal(during.value, before.value);
    } finally {
        release();
        await completed;
    }

    const after = await import("./singleton.mjs");
    assert.equal(after.value, before.value);
}

await load("com.gtkx.configfirst", shouldFail);
await load("com.gtkx.configsecond", false);
`;

describe("configuration import isolation", () => {
    it.each(["success", "failure"])("preserves unrelated modules across %s and reload", (outcome) => {
        using project = createCliProject({
            prefix: "gtkx-config-isolation-",
            files: {
                "gtkx.config.mjs": CONFIG,
                "singleton.mjs": "export const value = {};\n",
                "probe.mjs": PROBE,
            },
        });
        const result = spawnSync(process.execPath, [join(project.root, "probe.mjs"), outcome], {
            cwd: project.root,
            encoding: "utf8",
            timeout: 30_000,
        });

        expect(result.status).toBe(0);
    });
});

describe("renderer configuration before codegen", () => {
    it("loads installed element definitions without existing generated bindings", () => {
        const config = fixtureLibrariesConfig(["Documented-1.0"]).replace(
            "export default {",
            () => 'import { BUILTIN_ELEMENTS } from "@gtkx/react/config";\n' +
                "export default { elements: { config: BUILTIN_ELEMENTS },",
        );
        using project = createCliProject({
            prefix: "gtkx-config-before-codegen-",
            config,
            omitPackages: ["react"],
        });
        const reactPackage = join(project.nodeModules, "@gtkx/react");
        mkdirSync(reactPackage);
        cpSync(new URL("../../react/package.json", import.meta.url), join(reactPackage, "package.json"));
        cpSync(new URL("../../react/dist", import.meta.url), join(reactPackage, "dist"), { recursive: true });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        expect(existsSync(join(project.nodeModules, "@gtkx/gi/documented/documented.js"))).toBe(true);
        expect(existsSync(join(project.nodeModules, "@gtkx/jsx/documented/documented.js"))).toBe(true);
    });
});
