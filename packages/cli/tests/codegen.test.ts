import { chmodSync, existsSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    removeCliProject,
    runCli,
    STORE_FUTURE,
    STORE_LIBRARIES,
} from "./cli-project.js";

type BrokenCase = { title: string; config: string | undefined };

type ByteSequenceCase = {
    title: string;
    v2ByteArrays: boolean | undefined;
    declarations: string[];
    bindings: string[];
};

type OmittedFieldCase = { title: string; jsName: string };
type CodegenRunState = { project: CliProject; status: number | null; output: string };
type DocumentedModuleCase = { title: string; store: string; stem: string; docs: string[] };
type HoverCase = { title: string; text: string; doc: string };

type ValueReturnCase = {
    title: string;
    v2ValueReturns: boolean | undefined;
    declarations: string[];
    bindings: string[];
};

type FinishResultCase = {
    title: string;
    v2FinishResults: boolean | undefined;
    declarations: string[];
    bindings: string[];
};

type InoutReturnCase = {
    title: string;
    v2InoutReturns: boolean | undefined;
    declarations: string[];
    bindings: string[];
};

const APPLICATION_ID = "com.gtkx.clicodegen";
const MARKER = "probe-marker.txt";
const FIXTURE_GIR = fileURLToPath(new URL("fixtures/gir", import.meta.url));
const CAIRO_PACKAGE = "@gtkx/cairo";
const WORKSPACE_CAIRO = fileURLToPath(new URL("../../cairo", import.meta.url));

const GI_MODULES = [
    join("gtk", "gtk.js"),
    join("gtk", "index.js"),
    join("gtk", "index.d.ts"),
    "package.json",
];

const JSX_MODULES = ["index.js", "metadata.js", join("gtk", "gtk.js"), "package.json"];
const HEAD = `export default { applicationId: "${APPLICATION_ID}"`;

const BROKEN_CASES: BrokenCase[] = [
    { title: "no configuration file at all", config: undefined },
    { title: "a configuration that declares no application id", config: "export default { libraries: [] };\n" },
    { title: "a configuration whose libraries are empty", config: `${HEAD}, libraries: [] };\n` },
    { title: "a configuration whose gir path is not a list", config: `${HEAD}, girPath: 5 };\n` },
    { title: "a library that has no GIR file installed", config: `${HEAD}, libraries: ["Absent-1.0"] };\n` },
    { title: "a future flag that is not a boolean", config: `${HEAD}, future: { v2InoutReturns: "soon" } };\n` },
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

const VALUE_PARAMETER_DECLARATIONS = [
    "store(value: GObject.Value | JsValue): void",
    "storeMaybe(value: GObject.Value | JsValue | null): void",
    "storeAll(values: (GObject.Value | JsValue)[]): void",
    "fillInPlace(value: GObject.Value): void",
];

const VALUE_PARAMETER_BINDINGS = [
    "valueBoxHolderStore(getHandle(this), toValueHandle(value))",
    "valueBoxHolderStoreMaybe(getHandle(this), tryToValueHandle(value))",
    "values.map((item) => toValueHandle(item))",
    "valueBoxHolderFillInPlace(getHandle(this), getHandle(value))",
];

const VALUE_RETURN_CASES: ValueReturnCase[] = [
    {
        title: "hands back the value itself unless the project opts in",
        v2ValueReturns: undefined,
        declarations: ["peek(): GObject.Value", "fill(): [boolean, GObject.Value]"],
        bindings: ['{ type: t.boxed("GValue"'],
    },
    {
        title: "hands back what the value holds once the project opts in",
        v2ValueReturns: true,
        declarations: ["peek(): unknown", "fill(): [boolean, unknown]"],
        bindings: ["isReturnUnpacked: true", "isUnpacked: true"],
    },
];

const FINISH_RESULT_CASES: FinishResultCase[] = [
    {
        title: "resolves promisified results with the leading boolean unless the project opts in",
        v2FinishResults: undefined,
        declarations: [
            "runAsync(): Promise<[boolean, string, number]>",
            "probeAsync(): Promise<boolean>",
        ],
        bindings: ["promisify(asyncPairJobRunAsync, this.runFinish.bind(this)"],
    },
    {
        title: "resolves promisified results without the leading boolean once the project opts in",
        v2FinishResults: true,
        declarations: [
            "runAsync(): Promise<[string, number]>",
            "probeAsync(): Promise<boolean>",
        ],
        bindings: ["promisify(asyncPairJobRunAsync, trimFinish(this.runFinish.bind(this))"],
    },
];

const INOUT_RETURN_CASES: InoutReturnCase[] = [
    {
        title: "returns an inout record alongside the result unless the project opts in",
        v2InoutReturns: undefined,
        declarations: [
            "step(spot: Spot): [boolean, Spot]",
            "recenter(spot: Spot): Spot",
            "advance(offset: number): [boolean, number]",
            "locate(spot: Spot): [boolean, Spot, string]",
        ],
        bindings: ['direction: "inout", isCallerAllocated: true, isRequired: true }'],
    },
    {
        title: "mutates an inout record in place once the project opts in",
        v2InoutReturns: true,
        declarations: [
            "step(spot: Spot): boolean",
            "recenter(spot: Spot): void",
            "advance(offset: number): [boolean, number]",
            "locate(spot: Spot): [boolean, string]",
        ],
        bindings: [
            'direction: "inout", isCallerAllocated: true, isConsumed: true, isRequired: true }',
            't.int32, direction: "inout", isRequired: true }',
        ],
    },
];

const RECORD_FIELD_ACCESSORS = [
    "get refCount(): number;",
    "set refCount(value: number);",
    "get interfaces(): Iface[];",
];

const ARRAY_WRITES = ["set interfaces(", "interfaces?:", "props.interfaces"];

const INLINE_ARRAY_ACCESSORS = [
    "get axes(): number[];",
    "set axes(__value: number[]);",
    "get corners(): Corner[];",
    "set corners(__value: Corner[]);",
    "get spans(): Span[];",
    "set spans(__value: Span[]);",
];

const INLINE_ELEMENT_DESCRIPTORS = [
    '"inline_array_corner_get_type", isInline: true, size: 16 }',
    't.struct("borrowed", { size: 8, wrapperClass: Span, isInline: true })',
];

const INLINE_ARRAY_FIELDS = ["axes", "corners", "spans"];
const POINTER_ARRAY_FIELDS = ["names", "buffer"];
const OMITTED_ARRAY_FIELDS = ["handles", "slots"];
const AXES_GETTER = /get axes\(\) \{\s+const __result = \[\];\s+for \(let __index = 0; __index < 4/u;
const AXES_READ = /__result\[__index\] = read\(getHandle\(this\), \w+, 0 \+ __index \* 8\);/u;
const AXES_SETTER = /set axes\(__value\) \{\s+for \(const \[__index, __element\] of __value\.entries/u;
const AXES_BOUND = /if \(__index >= 4\) \{\s+break;\s+\}/u;
const AXES_WRITE = /write\(getHandle\(this\), (\w+), 0 \+ __index \* 8, toNative\(\1, __element\)\);/u;
const CORNER_READ = /__result\[__index\] = fromNative\(\w+, read\(getHandle\(this\), \w+, 32 \+ __index \* 16\)\)/u;
const CORNER_WRITE = /write\(getHandle\(this\), (\w+), 32 \+ __index \* 16, toNative\(\1, __element\)\);/u;
const POINTER_ARRAY_GETTER = /get buffer\(\) \{\s+return fromNative\(/u;
const LENGTH_BOUNDED_READ = /read\(getHandle\(this\), t\.struct\("borrowed", \{ size: this\.nLinks \* 8 \}\), 8\)/u;
const AXES_EMISSION = [AXES_GETTER, AXES_READ, AXES_SETTER, AXES_BOUND, AXES_WRITE];

const OMITTED_FIELD_CASES: OmittedFieldCase[] = [
    { title: "an array whose length lives in a sibling field", jsName: "entries" },
    { title: "a linked list", jsName: "links" },
];

const NOTE_DOC = "Holds a short piece of text the user jotted down.";
const READ_DOC = "Reads the note back in the given tone.";
const COMMENT = /\/\*|\/\//u;

const DOCUMENTED_MODULE_CASES: DocumentedModuleCase[] = [
    {
        title: "a namespace the bindings come from",
        store: "gi",
        stem: join("documented", "documented"),
        docs: [
            `/** ${NOTE_DOC} */`,
            "/** Read the note out across the room. */",
            `* ${READ_DOC}`,
            "* @param tone How loudly to read it.",
            "* @deprecated Since 1.0. Use `read()` with Tone.LOUD instead.",
        ],
    },
    {
        title: "a namespace the elements come from",
        store: "jsx",
        stem: join("documented", "documented"),
        docs: [`/** ${NOTE_DOC} */`],
    },
    {
        title: "a hand-written override",
        store: "gi",
        stem: join("gobject", "overrides", "object"),
        docs: ["* @param handlerId Id of the handler to disconnect."],
    },
];

const HOVER_PROBE = [
    'import { Note, Tone } from "@gtkx/gi/documented";',
    'import { DocumentedNote } from "@gtkx/jsx/documented";',
    "",
    "export const note = new Note();",
    "note.read(Tone.LOUD);",
    "export const element = <DocumentedNote />;",
    "",
].join("\n");

const HOVER_CASES: HoverCase[] = [
    { title: "a method", text: "read(", doc: READ_DOC },
    { title: "an element", text: "DocumentedNote />", doc: NOTE_DOC },
];

const HOVER_OPTIONS: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    skipLibCheck: true,
};

const config = (body: string): string => `${HEAD}${body} };\n`;

const fixtureConfig = (library: string): string =>
    config(`, libraries: ${JSON.stringify([library])}, girPath: ${JSON.stringify([FIXTURE_GIR])}`);

const valueBoxConfig = (v2ValueReturns: boolean | undefined): string => {
    const future = v2ValueReturns === undefined ? "" : `, future: { v2ValueReturns: ${String(v2ValueReturns)} }`;

    return config(`, libraries: ["ValueBox-1.0"], girPath: ${JSON.stringify([FIXTURE_GIR])}${future}`);
};

const asyncPairConfig = (v2FinishResults: boolean | undefined): string => {
    const future = v2FinishResults === undefined ? "" : `, future: { v2FinishResults: ${String(v2FinishResults)} }`;

    return config(`, libraries: ["AsyncPair-1.0"], girPath: ${JSON.stringify([FIXTURE_GIR])}${future}`);
};

const inoutBoxConfig = (v2InoutReturns: boolean | undefined): string => {
    const future = v2InoutReturns === undefined ? "" : `, future: { v2InoutReturns: ${String(v2InoutReturns)} }`;

    return config(`, libraries: ["InoutBox-1.0"], girPath: ${JSON.stringify([FIXTURE_GIR])}${future}`);
};

const byteSeqConfig = (v2ByteArrays: boolean | undefined): string => {
    const future = v2ByteArrays === undefined ? "" : `, future: { v2ByteArrays: ${String(v2ByteArrays)} }`;

    return config(
        `, libraries: ["ByteSeq-1.0"], girPath: ${JSON.stringify([FIXTURE_GIR])}${future}`,
    );
};

const initialRunState = (): CodegenRunState => ({
    project: { root: "", nodeModules: "" },
    status: null,
    output: "",
});

const runInitialCodegen = (state: CodegenRunState, options: Parameters<typeof createCliProject>[0]): void => {
    state.project = createCliProject(options);
    const run = runCli(state.project, ["codegen"]);
    state.status = run.status;
    state.output = run.output;
};

const generatedModule = (project: CliProject, ...segments: string[]): string =>
    readFileSync(join(project.nodeModules, ".gtkx", ...segments), "utf8");

const storePath = (project: CliProject, ...segments: string[]): string =>
    join(project.nodeModules, ".gtkx", ...segments);

const linkPath = (project: CliProject, ...segments: string[]): string =>
    join(project.nodeModules, "@gtkx", ...segments);

const storeLocalCairoLink = (project: CliProject, store: string): string =>
    storePath(project, store, "node_modules", "@gtkx", "cairo");

const storeManifest = (project: CliProject, store: string): { peerDependencies?: Record<string, string> } =>
    JSON.parse(generatedModule(project, store, "package.json")) as { peerDependencies?: Record<string, string> };

const resolveCairoFrom = (project: CliProject): string =>
    createRequire(storePath(project, "gi", "gtk", "gtk.js")).resolve(`${CAIRO_PACKAGE}/package.json`);

const markStore = (project: CliProject): void => {
    writeFileSync(storePath(project, "gi", MARKER), "");
};

const isStoreMarked = (project: CliProject): boolean => existsSync(storePath(project, "gi", MARKER));

const expectModules = (directory: string, modules: string[]): void => {
    expect(modules.filter((name) => !existsSync(join(directory, name)))).toEqual([]);
};

const expectStoreAndLink = (project: CliProject, store: string, modules: string[]): void => {
    expectModules(storePath(project, store), modules);
    expectModules(linkPath(project, store), modules);
};

const omittedMentions = (source: string, jsName: string): string[] =>
    [`${jsName}:`, `get ${jsName}(`, `set ${jsName}(`].filter((text) => source.includes(text));

const classBody = (source: string, className: string): string => {
    const start = source.indexOf(`class ${className} `);
    const end = source.indexOf("\n}", start);

    return start === -1 || end === -1 ? "" : source.slice(start, end);
};

const hoverHost = (project: CliProject, filePath: string): ts.LanguageServiceHost => ({
    getCompilationSettings: () => HOVER_OPTIONS,
    getScriptFileNames: () => [filePath],
    getScriptVersion: () => "1",
    getScriptSnapshot: (name) => {
        const text = ts.sys.readFile(name);

        return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => project.root,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: (name) => ts.sys.fileExists(name),
    readFile: (name) => ts.sys.readFile(name),
    readDirectory: (...args) => ts.sys.readDirectory(...args),
    directoryExists: (name) => ts.sys.directoryExists(name),
    getDirectories: (name) => ts.sys.getDirectories(name),
});

const hoverDoc = (project: CliProject, fileName: string, text: string): string => {
    const filePath = join(project.root, fileName);
    const position = readFileSync(filePath, "utf8").indexOf(text);
    expect(position).toBeGreaterThanOrEqual(0);
    const service = ts.createLanguageService(hoverHost(project, filePath));

    try {
        return ts.displayPartsToString(service.getQuickInfoAtPosition(filePath, position)?.documentation);
    } finally {
        service.dispose();
    }
};

describe("gtkx codegen", () => {
    const state = initialRunState();

    beforeAll(() => {
        runInitialCodegen(state, { prefix: "gtkx-cli-codegen-", config: config("") });
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("writes both stores where the project imports them", () => {
        expect(state.status).toBe(0);
        expectStoreAndLink(state.project, "gi", GI_MODULES);
        expectStoreAndLink(state.project, "jsx", JSX_MODULES);
    });

    it("binds cairo through @gtkx/cairo and keeps the deprecated @gtkx/gi/cairo alias", () => {
        expect(state.status).toBe(0);
        expect(generatedModule(state.project, "gi", "gtk", "gtk.js")).toContain(`import "${CAIRO_PACKAGE}";`);

        expect(generatedModule(state.project, "gi", "gtk", "gtk.d.ts"))
            .toContain(`import * as cairo from "${CAIRO_PACKAGE}";`);

        expect(generatedModule(state.project, "gi", "cairo", "index.js"))
            .toContain(`export * from "${CAIRO_PACKAGE}";`);

        expect(existsSync(storePath(state.project, "gi", "cairo", "cairo.js"))).toBe(false);
        expect(storeManifest(state.project, "gi").peerDependencies?.[CAIRO_PACKAGE]).toBe("*");
        expect(storeManifest(state.project, "jsx").peerDependencies?.[CAIRO_PACKAGE]).toBe("*");
        const installed = realpathSync(join(state.project.nodeModules, "@gtkx", "cairo", "package.json"));
        expect(realpathSync(resolveCairoFrom(state.project))).toBe(installed);
        expect(existsSync(storeLocalCairoLink(state.project, "gi"))).toBe(false);
        expect(state.output).not.toContain("add @gtkx/cairo to your dependencies");
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

    it("regenerates a store that lacks the jsx index module", () => {
        rmSync(storePath(state.project, "jsx", "index.js"), { force: true });
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expectModules(storePath(state.project, "jsx"), JSX_MODULES);
    });

    it("rebuilds the store from scratch when it is forced", () => {
        markStore(state.project);
        expect(runCli(state.project, ["codegen", "--force"]).status).toBe(0);
        expect(isStoreMarked(state.project)).toBe(false);
        expectModules(storePath(state.project, "gi"), GI_MODULES);
        expectModules(storePath(state.project, "jsx"), JSX_MODULES);
    });
});

describe("gtkx codegen (a project that does not install @gtkx/cairo)", () => {
    const state = initialRunState();

    beforeAll(() => {
        runInitialCodegen(state, {
            prefix: "gtkx-cli-codegen-nocairo-",
            config: config(""),
            omitPackages: ["cairo"],
        });
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("links the copy @gtkx/codegen depends on into both stores", () => {
        expect(state.status).toBe(0);
        expect(realpathSync(storeLocalCairoLink(state.project, "gi"))).toBe(realpathSync(WORKSPACE_CAIRO));
        expect(realpathSync(storeLocalCairoLink(state.project, "jsx"))).toBe(realpathSync(WORKSPACE_CAIRO));
        expect(realpathSync(resolveCairoFrom(state.project))).toBe(realpathSync(join(WORKSPACE_CAIRO, "package.json")));
        expect(state.output).toContain("add @gtkx/cairo to your dependencies");
    });

    it("fails when the fallback copy cannot be linked into the store", () => {
        const storeModules = storePath(state.project, "gi", "node_modules");
        rmSync(join(storeModules, "@gtkx"), { recursive: true, force: true });
        chmodSync(storeModules, 0o555);

        try {
            expect(runCli(state.project, ["codegen"]).status).not.toBe(0);
        } finally {
            chmodSync(storeModules, 0o755);
        }
    });

    it("keeps the link across runs and drops it once the project installs the package", () => {
        expect(runCli(state.project, ["codegen"]).status).toBe(0);
        expect(realpathSync(storeLocalCairoLink(state.project, "gi"))).toBe(realpathSync(WORKSPACE_CAIRO));
        symlinkSync(WORKSPACE_CAIRO, join(state.project.nodeModules, "@gtkx", "cairo"), "dir");
        const run = runCli(state.project, ["codegen"]);
        expect(run.status).toBe(0);
        expect(existsSync(storeLocalCairoLink(state.project, "gi"))).toBe(false);
        expect(existsSync(storeLocalCairoLink(state.project, "jsx"))).toBe(false);
        expect(run.output).toContain("is not declared in this project's package.json");
    });
});

describe("gtkx codegen (a project that installed the workspace store)", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "" } };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-installed-",
            config: config(
                `, libraries: ${JSON.stringify(STORE_LIBRARIES)}, future: ${JSON.stringify(STORE_FUTURE)}`,
            ),
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

describe("gtkx codegen (where the documentation goes)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
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

    it.each(DOCUMENTED_MODULE_CASES)("documents $title in its declaration alone", ({ store, stem, docs }) => {
        expect(state.status).toBe(0);
        const declared = generatedModule(state.project, store, `${stem}.d.ts`);
        expect(docs.filter((text) => !declared.includes(text))).toEqual([]);
        expect(generatedModule(state.project, store, `${stem}.js`)).not.toMatch(COMMENT);
    });

    it.each(HOVER_CASES)("surfaces the documentation of $title on hover", ({ text, doc }) => {
        expect(state.status).toBe(0);
        expect(hoverDoc(state.project, join("src", "probe.tsx"), text)).toContain(doc);
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

    it.each(OMITTED_FIELD_CASES)("declares no member for $title", ({ jsName }) => {
        expect(state.status).toBe(0);
        const emitted = `${classBody(declarations(), "Node")}${classBody(bindings(), "Node")}`;
        expect(emitted).toContain("get interfaces(): Iface[];");
        expect(omittedMentions(emitted, jsName)).toEqual([]);
        expect(declarations()).not.toContain(`${jsName}?:`);
    });

    it("tags an interface that registers a GType", () => {
        expect(state.status).toBe(0);
        const declared = classBody(declarations(), "Provider");
        expect(declared).toContain("class Provider ");
        expect(declared).toContain("__type__");
    });

    it("leaves a record that registers no GType without one", () => {
        expect(state.status).toBe(0);
        const declared = classBody(declarations(), "Plain");
        expect(declared).toContain("class Plain ");
        expect(declared).not.toContain("__type__");
    });
});

describe("gtkx codegen (fixed-size array fields stored inline)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    const declarations = (): string => generatedModule(state.project, "gi", "inlinearray", "inlinearray.d.ts");
    const bindings = (): string => generatedModule(state.project, "gi", "inlinearray", "inlinearray.js");

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-inline-",
            config: fixtureConfig("InlineArray-1.0"),
        });

        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("reads and writes an array of numbers element by element", () => {
        expect(state.status).toBe(0);
        const declared = classBody(declarations(), "Frame");
        expect(INLINE_ARRAY_ACCESSORS.filter((text) => !declared.includes(text))).toEqual([]);
        const bound = classBody(bindings(), "Frame");
        expect(AXES_EMISSION.filter((pattern) => !pattern.test(bound))).toEqual([]);
    });

    it("reads and writes a record element as an instance of its own type", () => {
        expect(state.status).toBe(0);
        const bound = classBody(bindings(), "Frame");
        expect(bound).toMatch(CORNER_READ);
        expect(bound).toMatch(CORNER_WRITE);
        expect(INLINE_ELEMENT_DESCRIPTORS.filter((text) => !bindings().includes(text))).toEqual([]);
    });

    it("stores through the array fields that live inline and through no other", () => {
        expect(state.status).toBe(0);
        const emitted = `${classBody(declarations(), "Frame")}${classBody(bindings(), "Frame")}`;
        expect(INLINE_ARRAY_FIELDS.filter((name) => !emitted.includes(`set ${name}(`))).toEqual([]);
        expect(POINTER_ARRAY_FIELDS.filter((name) => emitted.includes(`set ${name}(`))).toEqual([]);
        expect(POINTER_ARRAY_FIELDS.filter((name) => !emitted.includes(`get ${name}(`))).toEqual([]);
        expect(classBody(bindings(), "Frame")).toMatch(POINTER_ARRAY_GETTER);
    });

    it("reaches an array the way it is stored and declares no member when it cannot", () => {
        expect(state.status).toBe(0);
        const frame = `${classBody(declarations(), "Frame")}${classBody(bindings(), "Frame")}`;
        expect(frame).toContain("get axes(");
        expect(OMITTED_ARRAY_FIELDS.flatMap((name) => omittedMentions(frame, name))).toEqual([]);
        const chain = classBody(bindings(), "Chain");
        expect(chain).toMatch(LENGTH_BOUNDED_READ);
        expect(chain).toContain("set links(");
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

describe("gtkx codegen (values a binding takes and hands back)", () => {
    it("takes a JavaScript value wherever a GValue is expected", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-values-",
            config: valueBoxConfig(undefined),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            const emitted = generatedModule(project, "gi", "valuebox", "valuebox.d.ts");
            const emittedBindings = generatedModule(project, "gi", "valuebox", "valuebox.js");
            expect(VALUE_PARAMETER_DECLARATIONS.filter((text) => !emitted.includes(text))).toEqual([]);
            expect(VALUE_PARAMETER_BINDINGS.filter((text) => !emittedBindings.includes(text))).toEqual([]);
        } finally {
            removeCliProject(project);
        }
    });

    it.each(VALUE_RETURN_CASES)("$title", ({ v2ValueReturns, declarations, bindings }) => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-value-returns-",
            config: valueBoxConfig(v2ValueReturns),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            const emitted = generatedModule(project, "gi", "valuebox", "valuebox.d.ts");
            const emittedBindings = generatedModule(project, "gi", "valuebox", "valuebox.js");
            expect(declarations.filter((text) => !emitted.includes(text))).toEqual([]);
            expect(bindings.filter((text) => !emittedBindings.includes(text))).toEqual([]);
        } finally {
            removeCliProject(project);
        }
    });

    it("regenerates a fresh store when the value return setting changes", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-value-returns-flip-",
            config: valueBoxConfig(true),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            markStore(project);
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(isStoreMarked(project)).toBe(true);
            writeFileSync(join(project.root, "gtkx.config.ts"), valueBoxConfig(undefined));
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(isStoreMarked(project)).toBe(false);
            expect(generatedModule(project, "gi", "valuebox", "valuebox.d.ts")).toContain("peek(): GObject.Value");
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx codegen (promisified finish results)", () => {
    it.each(FINISH_RESULT_CASES)("$title", ({ v2FinishResults, declarations, bindings }) => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-finish-results-",
            config: asyncPairConfig(v2FinishResults),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            const emitted = generatedModule(project, "gi", "asyncpair", "asyncpair.d.ts");
            const emittedBindings = generatedModule(project, "gi", "asyncpair", "asyncpair.js");
            expect(declarations.filter((text) => !emitted.includes(text))).toEqual([]);
            expect(bindings.filter((text) => !emittedBindings.includes(text))).toEqual([]);
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx codegen (inout records a binding mutates in place)", () => {
    it.each(INOUT_RETURN_CASES)("$title", ({ v2InoutReturns, declarations, bindings }) => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-inout-returns-",
            config: inoutBoxConfig(v2InoutReturns),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            const emitted = generatedModule(project, "gi", "inoutbox", "inoutbox.d.ts");
            const emittedBindings = generatedModule(project, "gi", "inoutbox", "inoutbox.js");
            expect(declarations.filter((text) => !emitted.includes(text))).toEqual([]);
            expect(bindings.filter((text) => !emittedBindings.includes(text))).toEqual([]);
        } finally {
            removeCliProject(project);
        }
    });

    it("regenerates a fresh store when the inout return setting changes", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-inout-returns-flip-",
            config: inoutBoxConfig(true),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            markStore(project);
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(isStoreMarked(project)).toBe(true);
            writeFileSync(join(project.root, "gtkx.config.ts"), inoutBoxConfig(undefined));
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(isStoreMarked(project)).toBe(false);
            expect(generatedModule(project, "gi", "inoutbox", "inoutbox.d.ts")).toContain("recenter(spot: Spot): Spot");
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx codegen (callback arguments of vtable slots)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    const declarations = (): string => generatedModule(state.project, "gi", "hookslots", "hookslots.d.ts");
    const bindings = (): string => generatedModule(state.project, "gi", "hookslots", "hookslots.js");

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-hook-slots-",
            config: fixtureConfig("HookSlots-1.0"),
        });

        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("decodes a slot callback whose user data sits right after it", () => {
        expect(state.status).toBe(0);

        expect(bindings()).toContain(
            't.callback([t.int32, t.biguint64], t.boolean, { hasUserData: true, userDataIndex: 1, scope: "async" })',
        );

        expect(declarations()).toContain("vfuncBind(hook: HookFunc | null): void;");
    });

    it("keeps a slot callback that carries a destroy notify opaque", () => {
        expect(state.status).toBe(0);
        const watchSlot = bindings().split('vfuncName: "watch"', 2)[1] ?? "";

        expect(watchSlot).toContain(
            'argDescriptors: [t.object("borrowed"), t.biguint64, t.biguint64, t.biguint64]',
        );

        expect(declarations()).toContain(
            "vfuncWatch(hook: bigint | null, userData: bigint | null, destroy: bigint | null): void;",
        );
    });

    it("keeps a slot callback whose user data is not adjacent opaque", () => {
        expect(state.status).toBe(0);
        const deferSlot = bindings().split('vfuncName: "defer"', 2)[1] ?? "";

        expect(deferSlot).toContain(
            'argDescriptors: [t.object("borrowed"), t.biguint64, t.int32, t.biguint64]',
        );

        expect(declarations()).toContain(
            "vfuncDefer(hook: bigint | null, stride: number, userData: bigint | null): void;",
        );
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
