import { resolveExecutable } from "@gtkx/utils";
import { spawnSync } from "node:child_process";
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { cliEnvironment, createCliProject } from "./cli-project.js";

const VITEST_ENTRY = fileURLToPath(new URL("../../../node_modules/vitest/vitest.mjs", import.meta.url));
const CLI_PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA_DIR = "extra-schemas";
const RUN_TIMEOUT = 300_000;

const schema = (id: string, value: string): string =>
    `<schemalist><schema id="${id}"><key name="value" type="s">` +
    `<default>'${value}'</default></key></schema></schemalist>`;

const CONFIG = `import gtkx from "@gtkx/cli/vitest-plugin";
import { fileURLToPath } from "node:url";

export default {
    plugins: [gtkx()],
    test: {
        include: ["settings.test.ts"],
        maxWorkers: 1,
        env: { GSETTINGS_SCHEMA_DIR: fileURLToPath(new URL("./${SCHEMA_DIR}", import.meta.url)) },
    },
};
`;

const TEST_SOURCE = `import * as Gio from "@gtkx/gi/gio";
import { expect, it } from "vitest";
import projectSchema from "./data/project.gschema.xml";

it("reads both project and configured schemas through the default source", () => {
    const source = Gio.SettingsSchemaSource.getDefault();
    const cases = [[projectSchema.id, "project"], ["org.gtkx.vitest.external", "configured"]] as const;
    for (const [id, expected] of cases) {
        const found = source?.lookup(id, true);
        if (found == null) throw new Error("Expected an available schema");
        expect(found.getKey("value").getDefaultValue().getString()[0]).toBe(expected);
    }
});
`;

it("keeps configured schema directories while staging imported project schemas", () => {
    using project = createCliProject({
        prefix: "gtkx-cli-vitest-settings-",
        config: 'export default { applicationId: "org.gtkx.vitestsettings", codegen: false };',
        hasStore: true,
        files: {
            "vitest.config.ts": CONFIG,
            "settings.test.ts": TEST_SOURCE,
            "data/project.gschema.xml": schema("org.gtkx.vitest.project", "project"),
            [join(SCHEMA_DIR, "external.gschema.xml")]: schema("org.gtkx.vitest.external", "configured"),
        },
    });
    symlinkSync(CLI_PACKAGE, join(project.nodeModules, "@gtkx", "cli"), "dir");
    const compiled = spawnSync(resolveExecutable("glib-compile-schemas"), [join(project.root, SCHEMA_DIR)], {
        encoding: "utf8",
        timeout: RUN_TIMEOUT,
    });
    expect(compiled.error).toBeUndefined();
    expect(compiled.signal).toBeNull();
    expect(compiled.status).toBe(0);

    const result = spawnSync(process.execPath, [VITEST_ENTRY, "run"], {
        cwd: project.root,
        encoding: "utf8",
        env: cliEnvironment(project),
        killSignal: "SIGKILL",
        timeout: RUN_TIMEOUT,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
});
