import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";

const CONFIG = 'export default { applicationId: "org.gtkx.settingsaudit", codegen: false };';
const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const ENV_FILE = "node_modules/.gtkx/env.d.ts";
const SCHEMA_FILE = "data/settings.gschema.xml";
const VALID_SCHEMA = `<schemalist><schema id="org.gtkx.Settings">
<key name="answer" type="i"><default>42</default></key>
</schema></schemalist>`;
const BASE = `<enum id="org.gtkx.Mode"><value nick="first" value="1"/></enum>
<flags id="org.gtkx.Features"><value nick="enabled" value="1"/></flags>
<schema id="org.gtkx.Base">
<key name="shared" type="s"><default>'initial'</default></key>
<key name="mode" enum="org.gtkx.Mode"><default>'first'</default></key>
<key name="features" flags="org.gtkx.Features"><default>['enabled']</default></key>
<key name="choice" type="s"><choices><choice value="first"/></choices><default>'first'</default></key>
</schema>`;
const MIDDLE = `<schema id="org.gtkx.Middle" extends="org.gtkx.Base">
<key name="enabled" type="b"><default>true</default></key>
</schema>`;
const CHILD = `<schema id="org.gtkx.Child" extends="org.gtkx.Middle" path="/org/gtkx/child/">
<override name="shared">'inherited'</override>
<key name="count" type="i"><default>7</default></key>
</schema>`;
const KEYS = { shared: "s", mode: "enum", features: "flags", choice: "s" };
const TYPECHECK_ARGS = [
    "--no-addons", TYPESCRIPT_CLI, "--noEmit", "--strict", "--skipLibCheck", "false",
    "--target", "ESNext", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--types", "node",
    ENV_FILE, "consumer.ts",
];

const inheritanceFiles = (layout: "one file" | "three files"): Record<string, string> => {
    const imports = layout === "one file"
        ? 'import { org_gtkx_Base as base, org_gtkx_Child as child } from "../data/settings.gschema.xml";'
        : 'import base from "../data/a-base.gschema.xml";\n' +
            'import "../data/b-middle.gschema.xml";\n' +
            'import child from "../data/c-child.gschema.xml";';
    const schemas = layout === "one file"
        ? { [SCHEMA_FILE]: `<schemalist>${BASE}${MIDDLE}${CHILD}</schemalist>` }
        : {
                "data/a-base.gschema.xml": `<schemalist>${BASE}</schemalist>`,
                "data/b-middle.gschema.xml": `<schemalist>${MIDDLE}</schemalist>`,
                "data/c-child.gschema.xml": `<schemalist>${CHILD}</schemalist>`,
            };

    return {
        ...schemas,
        "src/schemas.ts": `${imports}\nexport { base, child };\n`,
        "consumer.ts": `import { base, child } from "./src/schemas.js";
export const shared: "s" = child.keys.shared;
export const enabled: "b" = child.keys.enabled;
export const count: "i" = child.keys.count;
export const mode: "enum" = child.keys.mode;
export const features: "flags" = child.keys.features;
export const choice: "s" = child.keys.choice;
export const relocated: string | null = base.at("/org/gtkx/instance/").path;
`,
        "src/index.ts": `import { base, child } from "./schemas.js";
process.stdout.write(JSON.stringify({ base: base.at("/org/gtkx/instance/"), child }));
`,
    };
};

const schemaProject = () => createCliProject({
    prefix: "gtkx-cli-settings-",
    config: CONFIG,
    files: {
        [SCHEMA_FILE]: VALID_SCHEMA,
        "src/index.ts": 'import schema from "../data/settings.gschema.xml";\nprocess.stdout.write(schema.id);\n',
    },
});

const typecheck = (project: CliProject): void => {
    execFileSync(process.execPath, TYPECHECK_ARGS, { cwd: project.root, encoding: "utf8" });
};

describe("GSettings schema consumers", () => {
    it.each(["one file", "three files"] as const)("builds inherited settings from %s", (layout) => {
        using project = createCliProject({
            prefix: "gtkx-cli-settings-inherited-",
            config: CONFIG,
            hasStore: true,
            files: inheritanceFiles(layout),
        });
        runCliOrThrow(project, ["codegen"]);
        expect(() => {
            typecheck(project);
        }).not.toThrow();
        runCliOrThrow(project, ["build"]);
        const output = execFileSync(process.execPath, ["dist/bundle.mjs"], {
            cwd: project.root,
            encoding: "utf8",
        });
        expect(JSON.parse(output)).toEqual({
            base: { id: "org.gtkx.Base", path: "/org/gtkx/instance/", keys: KEYS },
            child: { id: "org.gtkx.Child", path: null, keys: { ...KEYS, enabled: "b", count: "i" } },
        });
        const value = execFileSync(resolveExecutable("gsettings"), [
            "--schemadir", join(project.root, "dist"), "get", "org.gtkx.Child", "shared",
        ], { env: { ...process.env, GSETTINGS_BACKEND: "memory" }, encoding: "utf8" });
        expect(value.trim()).toBe("'inherited'");
        writeFileSync(join(project.root, "consumer.ts"),
            'import { child } from "./src/schemas.js";\nexport const missing = child.keys.missing;\n');
        expect(() => {
            typecheck(project);
        }).toThrow();
    });

    it.each([
        ["unclosed XML", '<schemalist><schema id="org.gtkx.Settings">'],
        ["wrong root", "<settings/>"],
        ["empty schema", "<schemalist><schema/></schemalist>"],
        ["empty key", '<schemalist><schema id="org.gtkx.Settings"><key/></schema></schemalist>'],
        ["missing schema ID", '<schemalist><schema><key name="answer" type="i"/></schema></schemalist>'],
        ["missing key name", '<schemalist><schema id="org.gtkx.Settings"><key type="i"/></schema></schemalist>'],
        ["missing key kind", '<schemalist><schema id="org.gtkx.Settings"><key name="answer"/></schema></schemalist>'],
        ["missing base", '<schemalist><schema id="org.gtkx.Settings" extends="org.gtkx.Missing"/></schemalist>'],
        ["inheritance cycle", '<schemalist><schema id="org.gtkx.Settings" extends="org.gtkx.Settings"/></schemalist>'],
    ])("preserves consumer declarations after %s", (_title, source) => {
        using project = schemaProject();
        runCliOrThrow(project, ["codegen"]);
        const previous = readFileSync(join(project.root, ENV_FILE), "utf8");
        writeFileSync(join(project.root, SCHEMA_FILE), source);

        expect(() => runCliOrThrow(project, ["codegen"])).toThrow();
        expect(readFileSync(join(project.root, ENV_FILE), "utf8")).toBe(previous);
    });

    it("releases staging when native schema compilation fails during development", () => {
        using project = schemaProject();
        writeFileSync(join(project.root, SCHEMA_FILE), VALID_SCHEMA.replace("42", "'invalid'"));
        const scratch = join(project.root, "tmp");
        mkdirSync(scratch);

        expect(() => runCliOrThrow(project, ["dev"], { TMPDIR: scratch })).toThrow();
        expect(readdirSync(scratch)).toEqual([]);
    });
});
