import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli, STORE_LIBRARIES } from "./cli-project.js";

type BrokenCase = { title: string; config: string | undefined };

type ByteSequenceCase = {
    title: string;
    v2ByteArrays: boolean | undefined;
    declarations: string[];
    bindings: string[];
};

type OmittedFieldCase = { title: string; jsName: string };
type GtypeCase = { title: string; className: string };

const APPLICATION_ID = "com.gtkx.clicodegen";
const MARKER = "probe-marker.txt";
const FIXTURE_GIR = fileURLToPath(new URL("fixtures/gir", import.meta.url));

const GI_MODULES = [
    join("gtk", "gtk.js"),
    join("gtk", "index.js"),
    join("gtk", "index.d.ts"),
    "package.json",
];

const JSX_MODULES = ["metadata.js", join("gtk", "gtk.js"), "package.json"];
const HEAD = `export default { applicationId: "${APPLICATION_ID}"`;

const BROKEN_CASES: BrokenCase[] = [
    { title: "no configuration file at all", config: undefined },
    { title: "a configuration that declares no application id", config: "export default { libraries: [] };\n" },
    { title: "a configuration whose libraries are empty", config: `${HEAD}, libraries: [] };\n` },
    { title: "a configuration whose gir path is not a list", config: `${HEAD}, girPath: 5 };\n` },
    { title: "a library that has no GIR file installed", config: `${HEAD}, libraries: ["Absent-1.0"] };\n` },
    {
        title: "a GIR file that is not well-formed XML",
        config: `${HEAD}, libraries: ["Malformed-1.0"], girPath: ${JSON.stringify([FIXTURE_GIR])} };\n`,
    },
];

const BYTE_SEQUENCE_CASES: ByteSequenceCase[] = [
    {
        title: "represents byte sequences as numbers unless the project opts in",
        v2ByteArrays: undefined,
        declarations: [
            "readSized(): number[]",
            "readByteArray(): number[]",
            "writeSized(data: Uint8Array | number[]): void",
            "readNumbers(): number[]",
        ],
        bindings: ['t.array(t.uint8, "gbytearray"'],
    },
    {
        title: "represents byte sequences as typed arrays once the project opts in",
        v2ByteArrays: true,
        declarations: [
            "readSized(): Uint8Array",
            "readByteArray(): Uint8Array",
            "writeSized(data: Uint8Array | number[]): void",
            "readNumbers(): number[]",
        ],
        bindings: ["isBytes: true", "t.byteArray("],
    },
];

const RECORD_FIELD_ACCESSORS = [
    "get refCount(): number;",
    "set refCount(value: number);",
    "get interfaces(): Iface[];",
];

const ARRAY_WRITES = ["set interfaces(", "interfaces?:", "props.interfaces"];

const OMITTED_FIELD_CASES: OmittedFieldCase[] = [
    { title: "an array whose length lives in a sibling field", jsName: "entries" },
    { title: "a linked list", jsName: "links" },
];

const GTYPE_CASES: GtypeCase[] = [
    { title: "a record", className: "Node" },
    { title: "a class", className: "Widget" },
    { title: "an interface", className: "Provider" },
];

const GTYPE_LESS_CASES: GtypeCase[] = [
    { title: "a record", className: "Plain" },
    { title: "a class", className: "Loose" },
];

const config = (body: string): string => `${HEAD}${body} };\n`;

const fixtureConfig = (library: string): string =>
    config(`, libraries: ${JSON.stringify([library])}, girPath: ${JSON.stringify([FIXTURE_GIR])}`);

const byteSeqConfig = (v2ByteArrays: boolean | undefined): string => {
    const future = v2ByteArrays === undefined ? "" : `, future: { v2ByteArrays: ${String(v2ByteArrays)} }`;

    return config(
        `, libraries: ["ByteSeq-1.0"], girPath: ${JSON.stringify([FIXTURE_GIR])}${future}`,
    );
};

const generatedModule = (project: CliProject, ...segments: string[]): string =>
    readFileSync(join(project.nodeModules, ".gtkx", ...segments), "utf8");

const storePath = (project: CliProject, ...segments: string[]): string =>
    join(project.nodeModules, ".gtkx", ...segments);

const linkPath = (project: CliProject, ...segments: string[]): string =>
    join(project.nodeModules, "@gtkx", ...segments);

const markStore = (project: CliProject): void => {
    writeFileSync(storePath(project, "gi", MARKER), "");
};

const isStoreMarked = (project: CliProject): boolean => existsSync(storePath(project, "gi", MARKER));

const expectModules = (directory: string, modules: string[]): void => {
    expect(modules.filter((name) => !existsSync(join(directory, name)))).toEqual([]);
};

const omittedMentions = (source: string, jsName: string): string[] =>
    [`${jsName}:`, `get ${jsName}(`, `set ${jsName}(`].filter((text) => source.includes(text));

const classBody = (source: string, className: string): string => {
    const start = source.indexOf(`class ${className} `);
    const end = source.indexOf("\n}", start);

    return start === -1 || end === -1 ? "" : source.slice(start, end);
};

describe("gtkx codegen", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({ prefix: "gtkx-cli-codegen-", config: config("") });
        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("writes both stores where the project imports them", () => {
        expect(state.status).toBe(0);
        expectModules(storePath(state.project, "gi"), GI_MODULES);
        expectModules(storePath(state.project, "jsx"), JSX_MODULES);
        expectModules(linkPath(state.project, "gi"), GI_MODULES);
        expectModules(linkPath(state.project, "jsx"), JSX_MODULES);
    });

    it("leaves a fresh store alone, and restores a link an install pruned", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expect(isStoreMarked(state.project)).toBe(true);
        rmSync(linkPath(state.project, "gi"), { recursive: true, force: true });
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expect(existsSync(linkPath(state.project, "gi", "gtk", "index.js"))).toBe(true);
        expect(isStoreMarked(state.project)).toBe(true);
    });

    it("rebuilds the store from scratch when it is forced", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen", "--force"]).status).toBe(0);
        expect(isStoreMarked(state.project)).toBe(false);
        expectModules(storePath(state.project, "gi"), GI_MODULES);
        expectModules(storePath(state.project, "jsx"), JSX_MODULES);
    });
});

describe("gtkx codegen (a project that generates no store)", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "" } };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-disabled-",
            config: config(`, codegen: false, libraries: ${JSON.stringify(STORE_LIBRARIES)}`),
            hasStore: true,
        });
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("keeps the store the project installed for itself", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expect(isStoreMarked(state.project)).toBe(true);
        expectModules(linkPath(state.project, "gi"), GI_MODULES);
    });

    it("refuses to force a store it does not generate", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen", "--force"]).status).not.toBe(0);
        expect(isStoreMarked(state.project)).toBe(true);
    });
});

describe("gtkx codegen (libraries the generated types have to escape)", () => {
    it("binds a class whose static narrows the one it inherits", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-statics-",
            config: fixtureConfig("StaticNarrow-1.0"),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(generatedModule(project, "gi", "staticnarrow", "staticnarrow.d.ts")).toContain("StaticBase<");
        } finally {
            removeCliProject(project);
        }
    });

    it("binds a type whose GIR name starts with a digit", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-digit-",
            config: fixtureConfig("DigitName-1.0"),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(generatedModule(project, "gi", "digitname", "digitname.d.ts")).toContain("enum _80211Mode");
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx codegen (record fields and the GType a type registers)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    const declarations = (): string => generatedModule(state.project, "gi", "recordfields", "recordfields.d.ts");
    const bindings = (): string => generatedModule(state.project, "gi", "recordfields", "recordfields.js");

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-fields-",
            config: fixtureConfig("RecordFields-1.0"),
        });

        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("reads a null-terminated array field through an accessor", () => {
        expect(state.status).toBe(0);
        const declared = classBody(declarations(), "Node");
        expect(RECORD_FIELD_ACCESSORS.filter((text) => !declared.includes(text))).toEqual([]);
        const bound = classBody(bindings(), "Node");
        expect(bound).toMatch(/get interfaces\(\) \{\s+return fromNative\(\w+, read\(getHandle\(this\), \w+, 8\)\);/);
    });

    it("stores no array field, through an accessor or through the constructor", () => {
        expect(state.status).toBe(0);
        const emitted = `${declarations()}${bindings()}`;
        expect(ARRAY_WRITES.filter((text) => emitted.includes(text))).toEqual([]);
        expect(declarations()).toContain("refCount?:");
    });

    it.each(GTYPE_CASES)("exposes on $title the GType it registers", ({ className }) => {
        expect(state.status).toBe(0);
        expect(classBody(declarations(), className)).toContain("static get __gtype__(): bigint;");
        expect(classBody(bindings(), className)).toContain("return getClassType(this);");
    });

    it.each(OMITTED_FIELD_CASES)("declares no member for $title", ({ jsName }) => {
        expect(state.status).toBe(0);
        const emitted = `${classBody(declarations(), "Node")}${classBody(bindings(), "Node")}`;
        expect(emitted).toContain("get interfaces(): Iface[];");
        expect(omittedMentions(emitted, jsName)).toEqual([]);
        expect(declarations()).not.toContain(`${jsName}?:`);
    });

    it.each(GTYPE_LESS_CASES)("leaves $title that registers no GType without one", ({ className }) => {
        expect(state.status).toBe(0);
        const declared = classBody(declarations(), className);
        expect(declared).toContain(`class ${className} `);
        expect(declared).not.toMatch(/__g?type__/);
        expect(classBody(bindings(), className)).not.toContain("__gtype__");
    });
});

describe("gtkx codegen (byte sequence representation)", () => {
    it.each(BYTE_SEQUENCE_CASES)("$title", ({ v2ByteArrays, declarations, bindings }) => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-bytes-",
            config: byteSeqConfig(v2ByteArrays),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            const emitted = generatedModule(project, "gi", "byteseq", "byteseq.d.ts");
            const emittedBindings = generatedModule(project, "gi", "byteseq", "byteseq.js");
            expect(declarations.filter((text) => !emitted.includes(text))).toEqual([]);
            expect(bindings.filter((text) => !emittedBindings.includes(text))).toEqual([]);
        } finally {
            removeCliProject(project);
        }
    });

    it("regenerates a fresh store when the byte sequence setting changes", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-bytes-flip-",
            config: byteSeqConfig(true),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            markStore(project);
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(isStoreMarked(project)).toBe(true);
            writeFileSync(join(project.root, "gtkx.config.ts"), byteSeqConfig(undefined));
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(isStoreMarked(project)).toBe(false);
            expect(generatedModule(project, "gi", "byteseq", "byteseq.d.ts")).toContain("readSized(): number[]");
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx codegen (a project that does not declare itself a module)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-commonjs-",
            config: config(""),
            packageType: "commonjs",
        });

        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("writes stores that are still ECMAScript modules", () => {
        expect(state.status).toBe(0);
        expect(generatedModule(state.project, "jsx", "metadata.js")).not.toContain("__esModule");
        expect(generatedModule(state.project, "gi", "gtk", "gtk.js")).not.toContain("__esModule");
    });
});

describe("gtkx codegen (projects it cannot generate from)", () => {
    it.each(BROKEN_CASES)("fails over $title", ({ config: body }) => {
        const project = createCliProject({ prefix: "gtkx-cli-codegen-broken-", config: body });

        try {
            expect(runCli(project, ["codegen"]).status).not.toBe(0);
            expect(existsSync(storePath(project, "gi"))).toBe(false);
        } finally {
            removeCliProject(project);
        }
    });
});
