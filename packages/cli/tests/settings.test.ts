import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.settingsaudit", codegen: false };';
const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const ENV_FILE = "node_modules/.gtkx/env.d.ts";
const SCHEMA_FILE = "data/settings.gschema.xml";
const VALID_SCHEMA = `<schemalist><schema id="org.gtkx.Settings">
<key name="answer" type="i"><default>42</default></key>
</schema></schemalist>`;
const ENUMS = `<enum id="org.gtkx.Mode">
<value nick="first" value="1"/><value nick="hexadecimal" value="+0x2A"/>
<value nick="octal" value="010"/><value nick="negative" value="-07"/>
<value nick="minimum" value="-2147483648"/><value nick="maximum" value="2147483647"/>
<value nick="__proto__" value="9"/>
</enum>
<flags id="org.gtkx.Mode"><value nick="enabled" value="1"/><value nick="high" value="0x80000000"/></flags>`;
const BASE = `<schema id="org.gtkx.Base">
<key name="shared" type="s"><default>'initial'</default></key>
<key name="mode" enum="org.gtkx.Mode"><default>'first'</default></key>
<key name="features" flags="org.gtkx.Mode"><default>['enabled']</default></key>
<key name="choice" type="s">
<choices><choice value="first"/><choice value=" spaced "/></choices><default>'first'</default>
</key>
<key name="nested-choice" type="aams">
<choices><choice value="first"/><choice value="second"/></choices><default>[[nothing, just 'first']]</default>
</key>
</schema>`;
const MIDDLE = `<schema id="org.gtkx.Middle" extends="org.gtkx.Base">
<key name="enabled" type="b"><default>true</default></key>
</schema>`;
const CHILD = `<schema id="org.gtkx.Child" extends="org.gtkx.Middle" path="/org/gtkx/child/">
<override name="shared">'inherited'</override>
<key name="count" type="i"><default>7</default></key>
<key name="own-mode" enum="org.gtkx.Mode"><default>'octal'</default></key>
</schema>`;
const KEYS = { shared: "s", mode: "enum", features: "flags", choice: "s", "nested-choice": "aams" };
const MODE_VALUES = Object.fromEntries([
    ["first", 1], ["hexadecimal", 42], ["octal", 8], ["negative", -7],
    ["minimum", -2_147_483_648], ["maximum", 2_147_483_647], ["__proto__", 9],
]);
const VALUES = {
    mode: MODE_VALUES,
    features: { enabled: 1, high: 2_147_483_648 },
    choice: ["first", " spaced "],
    "nested-choice": ["first", "second"],
};
const TYPECHECK_ARGS = [
    "--no-addons", TYPESCRIPT_CLI, "--noEmit", "--strict", "--skipLibCheck", "false",
    "--exactOptionalPropertyTypes", "--noUncheckedIndexedAccess", "--noUncheckedSideEffectImports",
    "--target", "ESNext", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--types", "node",
    ENV_FILE, "consumer.ts",
];

const SCHEMA_LAYOUTS = {
    "one file": {
        imports: 'import { org_gtkx_Base as base, org_gtkx_Child as child } from "../data/settings.gschema.xml";',
        schemas: { [SCHEMA_FILE]: `<schemalist>${ENUMS}${BASE}${MIDDLE}${CHILD}</schemalist>` },
    },
    "three files": {
        imports: 'import base from "../data/a-base.gschema.xml";\n' +
            'import "../data/b-middle.gschema.xml";\n' +
            'import child from "../data/c-child.gschema.xml";',
        schemas: {
            "data/a-base.gschema.xml": `<schemalist>${ENUMS}${BASE}</schemalist>`,
            "data/b-middle.gschema.xml": `<schemalist>${MIDDLE}</schemalist>`,
            "data/c-child.gschema.xml": `<schemalist>${CHILD}</schemalist>`,
        },
    },
    "separate enums": {
        imports: 'import "../data/a-enums.gschema.xml";\n' +
            'import base from "../data/b-base.gschema.xml";\n' +
            'import child from "../data/c-child.gschema.xml";',
        schemas: {
            "data/a-enums.gschema.xml": `<schemalist>${ENUMS}</schemalist>`,
            "data/b-base.gschema.xml": `<schemalist>${BASE}${MIDDLE}</schemalist>`,
            "data/c-child.gschema.xml": `<schemalist>${CHILD}</schemalist>`,
        },
    },
};

const SCHEMA_LAYOUT_NAMES = Object.keys(SCHEMA_LAYOUTS) as (keyof typeof SCHEMA_LAYOUTS)[];

const inheritanceFiles = (layout: keyof typeof SCHEMA_LAYOUTS): Record<string, string> => {
    const { imports, schemas } = SCHEMA_LAYOUTS[layout];

    return {
        ...schemas,
        "src/schemas.ts": `${imports}\nexport { base, child };\n`,
        "consumer.ts": `import type * as Gio from "@gtkx/gi/gio";
import { useSetting } from "@gtkx/react";
import { base, child } from "./src/schemas.js";
export const shared: "s" = child.keys.shared;
export const enabled: "b" = child.keys.enabled;
export const count: "i" = child.keys.count;
export const mode: "enum" = child.keys.mode;
export const features: "flags" = child.keys.features;
export const choice: "s" = child.keys.choice;
export const relocated: string | null = base.at("/org/gtkx/instance/").path;
export const hexadecimal: 42 = child.values.mode.hexadecimal;
export const octal: 8 = base.values.mode.octal;
export const negative: -7 = child.values["own-mode"].negative;
export const prototype: 9 = child.values.mode.__proto__;
export const useSchemaValues = (settings: Gio.Settings) => {
    const [mode, setMode] = useSetting(settings, child, "mode");
    const [choice, setChoice] = useSetting(settings, child, "choice");
    const [nested, setNested] = useSetting(settings, child, "nested-choice");
    const [flags, setFlags] = useSetting(settings, child, "features");
    const exactMode: 1 | 42 | 8 | -7 | -2147483648 | 2147483647 | 9 = mode;
    const exactChoice: "first" | " spaced " = choice;
    const exactNested: ("first" | "second" | null)[][] = nested;
    const exactFlags: number = flags;
    setMode(child.values.mode.hexadecimal);
    setChoice(" spaced ");
    setNested([[null, "second"]]);
    setFlags(child.values.features.enabled + child.values.features.high);
    return [exactMode, exactChoice, exactNested, exactFlags];
};
export const useLegacySchema = (settings: Gio.Settings) => {
    const manual = { id: child.id, path: null, keys: { mode: "enum", choice: "s" } } as const;
    const [mode, setMode] = useSetting(settings, manual, "mode");
    const [choice, setChoice] = useSetting(settings, manual, "choice");
    const wideMode: number = mode;
    const wideChoice: string = choice;
    setMode(2);
    setChoice("other");
    return [wideMode, wideChoice];
};
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
    it.each(SCHEMA_LAYOUT_NAMES)("builds inherited settings from %s", (layout) => {
        using project = createCliProject({
            prefix: "gtkx-cli-settings-inherited-",
            config: CONFIG,
            hasStore: true,
            files: inheritanceFiles(layout),
        });
        runCliOrThrow(project, ["codegen"]);
        runCliOrThrow(project, ["build"]);
        const output = execFileSync(process.execPath, ["dist/bundle.mjs"], {
            cwd: project.root,
            encoding: "utf8",
        });
        expect(JSON.parse(output)).toEqual({
            base: { id: "org.gtkx.Base", path: "/org/gtkx/instance/", keys: KEYS, values: VALUES },
            child: {
                id: "org.gtkx.Child",
                path: null,
                keys: { ...KEYS, enabled: "b", count: "i", "own-mode": "enum" },
                values: { ...VALUES, "own-mode": MODE_VALUES },
            },
        });
        const value = execFileSync(resolveExecutable("gsettings"), [
            "--schemadir", join(project.root, "dist"), "get", "org.gtkx.Child", "shared",
        ], { env: { ...process.env, GSETTINGS_BACKEND: "memory" }, encoding: "utf8" });
        expect(value.trim()).toBe("'inherited'");
        isolateTypeConsumer(project);
        expect(() => {
            typecheck(project);
        }).not.toThrow();
        const rejected = [
            ...[
                "child.keys.missing",
                'useSetting(settings, child, "mode")[1](2)',
                'useSetting(settings, child, "choice")[1]("other")',
                'useSetting(settings, child, "nested-choice")[1]([["other"]])',
                'useSetting(settings, child, "features")[1]("enabled")',
            ].map((expression) =>
                'import type * as Gio from "@gtkx/gi/gio";\n' +
                'import { useSetting } from "@gtkx/react";\n' +
                'import { child } from "./src/schemas.js";\n' +
                `export const useRejected = (settings: Gio.Settings) => ${expression};\n`),
            ...(layout === "separate enums"
                ? ['import schema from "./data/a-enums.gschema.xml";\nexport const missing = schema.id;\n']
                : []),
        ];
        for (const consumer of rejected) {
            writeFileSync(join(project.root, "consumer.ts"), consumer);
            expect(() => {
                typecheck(project);
            }).toThrow();
        }
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
        [
            "missing enum",
            "<schemalist>" +
            '<schema id="org.gtkx.Settings">' +
            '<key name="mode" enum="org.gtkx.Missing"/>' +
            "</schema>" +
            "</schemalist>",
        ],
        [
            "invalid enum integer",
            "<schemalist>" +
            '<enum id="org.gtkx.Mode">' +
            '<value nick="first" value="1.5"/>' +
            "</enum>" +
            "</schemalist>",
        ],
        [
            "out-of-range enum integer",
            "<schemalist>" +
            '<enum id="org.gtkx.Mode">' +
            '<value nick="first" value="2147483648"/>' +
            "</enum>" +
            "</schemalist>",
        ],
        [
            "negative flags integer",
            "<schemalist>" +
            '<flags id="org.gtkx.Mode">' +
            '<value nick="first" value="-1"/>' +
            "</flags>" +
            "</schemalist>",
        ],
        [
            "missing choice value",
            "<schemalist>" +
            '<schema id="org.gtkx.Settings">' +
            '<key name="mode" type="s">' +
            "<choices>" +
            "<choice/>" +
            "</choices>" +
            "</key>" +
            "</schema>" +
            "</schemalist>",
        ],
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
