import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCliOrThrow } from "./cli-project.js";
import { classBody, fixtureConfig, generatedModule } from "./codegen-helpers.js";

const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const CODEGEN_ENTRY = new URL("../../codegen/dist/index.js", import.meta.url).href;
const TYPECHECK_ARGS = [
    "--no-addons", TYPESCRIPT_CLI, "--noEmit", "--strict", "--skipLibCheck", "false",
    "--target", "ESNext", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--types", "node",
];
const RECORD_CONSUMERS = {
    "visible.ts": `import { Visible } from "@gtkx/gi/girrecords";
import type { Collection, Mixed, Nested } from "@gtkx/gi/girrecords";
export const create = (): Visible => new Visible({ publicField: 1, tail: 2 });
export const read = (value: Visible): [number, number] => [value.publicField, value.tail];
export const mixed = (value: Mixed): [number, number] => [value.before, value.after];
export const nested = (value: Nested): [number, number] => [value.before, value.after];
export const items = (value: Collection): number[] => value.items.map((item) => item.publicField + item.tail);
`,
    "rejected-read.ts": `import type { Visible } from "@gtkx/gi/girrecords";
export const read = (value: Visible): bigint => value.hidden;
`,
    "rejected-write.ts": `import type { Visible } from "@gtkx/gi/girrecords";
export const write = (value: Visible): void => { value.hidden = 1n; };
`,
    "rejected-constructor.ts": `import { Visible } from "@gtkx/gi/girrecords";
export const create = (): Visible => new Visible({ hidden: 1n });
`,
    "rejected-element.ts": `import type { Collection } from "@gtkx/gi/girrecords";
export const read = (value: Collection): bigint[] => value.items.map((item) => item.hidden);
`,
};

const importConstants = (project: CliProject): unknown => JSON.parse(execFileSync(process.execPath, [
    "--no-addons", "--input-type=module", "--eval",
    `import {
    TEXT, PADDED, SPACES, EMPTY, ENTITIES, ENABLED, DISABLED, COUNT, IDENTIFIER,
} from "@gtkx/gi/girconstants";
process.stdout.write(JSON.stringify({
    TEXT, PADDED, SPACES, EMPTY, ENTITIES, ENABLED, DISABLED, COUNT, IDENTIFIER: String(IDENTIFIER),
}));`,
], { cwd: project.root, encoding: "utf8" }));

const nestedRecordGir = (hasSecondField: boolean): string => `<?xml version="1.0"?>
<repository version="1.2" xmlns="http://www.gtk.org/introspection/core/1.0"
  xmlns:c="http://www.gtk.org/introspection/c/1.0">
  <namespace name="RecordVersions" version="1.0">
    <record name="Inner" c:type="RecordVersionsInner">
      <field name="first"><type name="gint" c:type="gint"/></field>
      ${hasSecondField ? '<field name="second"><type name="gint" c:type="gint"/></field>' : ""}
    </record>
    <record name="Outer" c:type="RecordVersionsOuter">
      <field name="inner"><type name="Inner" c:type="RecordVersionsInner"/></field>
      <field name="tail"><type name="gint" c:type="gint"/></field>
    </record>
  </namespace>
</repository>
`;

describe("gtkx codegen GIR inputs", () => {
    it("preserves string contents alongside numeric and boolean constants", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-gir-constants-",
            config: fixtureConfig("GirConstants-1.0"),
            files: {
                "constants.ts": `import { PADDED, ENABLED, DISABLED, COUNT, IDENTIFIER } from "@gtkx/gi/girconstants";
export const padded: "  token, " = PADDED;
export const enabled: true = ENABLED;
export const disabled: false = DISABLED;
export const count: 42 = COUNT;
export const identifier: 9007199254740993n = IDENTIFIER;
`,
            },
        });
        runCliOrThrow(project, ["codegen"]);

        expect(importConstants(project)).toEqual({
            TEXT: "token",
            PADDED: "  token, ",
            SPACES: " ".repeat(3),
            EMPTY: "",
            ENTITIES: " &<>\"' ",
            ENABLED: true,
            DISABLED: false,
            COUNT: 42,
            IDENTIFIER: "9007199254740993",
        });
        expect(() => execFileSync(process.execPath, [...TYPECHECK_ARGS, "constants.ts"], {
            cwd: project.root,
            encoding: "utf8",
        })).not.toThrow();
    });

    it("retains published bindings when replacement GIR XML is malformed", () => {
        using project = createCliProject({ prefix: "gtkx-cli-gir-constants-invalid-" });
        const girPath = join(project.root, "gir");
        mkdirSync(girPath);
        const path = join(girPath, "RecordVersions-1.0.gir");
        writeFileSync(path, nestedRecordGir(false));
        const config = {
            applicationId: "com.gtkx.girinvalid",
            agents: { reference: false },
            libraries: ["RecordVersions-1.0"],
            girPath: [girPath],
        };
        writeFileSync(join(project.root, "gtkx.config.ts"), `export default ${JSON.stringify(config)};\n`);
        runCliOrThrow(project, ["codegen"]);
        const source = generatedModule(project, "gi", "recordversions", "recordversions.js");
        writeFileSync(path, "<repository><namespace>");

        expect(() => runCliOrThrow(project, ["codegen"])).toThrow();
        expect(generatedModule(project, "gi", "recordversions", "recordversions.js")).toBe(source);
    });
});

describe("gtkx codegen GIR record fields", () => {
    let project: CliProject;

    beforeAll(() => {
        project = createCliProject({
            prefix: "gtkx-cli-gir-records-",
            config: fixtureConfig("GirRecords-1.0"),
            files: RECORD_CONSUMERS,
        });
        runCliOrThrow(project, ["codegen"]);
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("accepts visible fields in records, constructor props and collection elements", () => {
        expect(() => execFileSync(process.execPath, [...TYPECHECK_ARGS, "visible.ts"], {
            cwd: project.root,
            encoding: "utf8",
        })).not.toThrow();
    });

    it.each(["rejected-read.ts", "rejected-write.ts", "rejected-constructor.ts", "rejected-element.ts"])(
        "rejects non-introspectable fields in %s",
        (file) => {
            expect(() => execFileSync(process.execPath, [...TYPECHECK_ARGS, file], {
                cwd: project.root,
                encoding: "utf8",
            })).toThrow();
        },
    );

    it("keeps hidden fields in native layout without emitting their accessors", () => {
        const source = generatedModule(project, "gi", "girrecords", "girrecords.js");
        expect(classBody(source, "Visible")).toMatch(/get tail\(\) \{\s+return read\(getHandle\(this\), \w+, 16\)/u);
        expect(classBody(source, "Collection")).toContain("this.count * 24");
        expect(source).not.toContain("hidden");
    });

    it("preserves interleaved and nested aggregate declaration order", () => {
        const source = generatedModule(project, "gi", "girrecords", "girrecords.js");
        expect(classBody(source, "Mixed")).toMatch(/get after\(\) \{\s+return read\(getHandle\(this\), \w+, 12\)/u);
        expect(classBody(source, "Nested")).toMatch(/get after\(\) \{\s+return read\(getHandle\(this\), \w+, 32\)/u);
    });
});

describe("public codegen record layouts", () => {
    it("uses each project's record definitions across successive generations", () => {
        using first = createCliProject({ prefix: "gtkx-cli-gir-record-first-" });
        using second = createCliProject({ prefix: "gtkx-cli-gir-record-second-" });

        for (const [project, hasSecondField] of [[first, false], [second, true]] as const) {
            const directory = join(project.root, "gir");
            mkdirSync(directory);
            writeFileSync(join(directory, "RecordVersions-1.0.gir"), nestedRecordGir(hasSecondField));
        }

        const script = `import { runCodegen } from ${JSON.stringify(CODEGEN_ENTRY)};
import { join } from "node:path";
for (const root of ${JSON.stringify([first.root, second.root])}) {
    await runCodegen({
        libraries: ["RecordVersions-1.0"],
        girPath: [join(root, "gir")],
        gi: {
            storeDir: join(root, "node_modules", ".gtkx", "gi"),
            linkDir: join(root, "node_modules", "@gtkx", "gi"),
            version: "1.0.0",
        },
    });
}
`;
        execFileSync(process.execPath, ["--no-addons", "--input-type=module", "--eval", script], {
            cwd: first.root,
            encoding: "utf8",
        });
        const firstSource = generatedModule(first, "gi", "recordversions", "recordversions.js");
        const secondSource = generatedModule(second, "gi", "recordversions", "recordversions.js");

        expect(classBody(firstSource, "Outer")).toMatch(/get tail\(\) \{\s+return read\(getHandle\(this\), \w+, 4\)/u);
        expect(classBody(secondSource, "Outer")).toMatch(/get tail\(\) \{\s+return read\(getHandle\(this\), \w+, 8\)/u);
    });
});
