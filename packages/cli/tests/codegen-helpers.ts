import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli } from "./cli-project.js";

type BrokenCase = { title: string; config: string | undefined };
type OmittedFieldCase = { title: string; jsName: string };
type CodegenRunState = { project: CliProject; status: number | null };
type DocumentedModuleCase = { title: string; store: string; stem: string; docs: string[] };
type HoverCase = { title: string; text: string; doc: string };

const APPLICATION_ID = "com.gtkx.clicodegen";
const MARKER = "probe-marker.txt";
const FIXTURE_GIR = fileURLToPath(new URL("fixtures/gir", import.meta.url));
const CAIRO_PACKAGE = "@gtkx/cairo";

const GI_MODULES = [
    join("gobject", "index.d.ts"),
    join("gtk", "gtk.js"),
    join("gtk", "index.js"),
    join("gtk", "index.d.ts"),
    "package.json",
];

const JSX_MODULES = [
    join("adw", "adw.js"),
    join("adw", "index.js"),
    "metadata.js",
    join("gtk", "gtk.js"),
    join("gtk", "index.js"),
    "package.json",
];
const HEAD = `export default { applicationId: "${APPLICATION_ID}"`;

const BROKEN_CASES: BrokenCase[] = [
    { title: "no configuration file at all", config: undefined },
    { title: "a configuration that declares no application id", config: "export default { libraries: [] };\n" },
    { title: "a configuration whose libraries are empty", config: `${HEAD}, libraries: [] };\n` },
    { title: "a configuration whose gir path is not a list", config: `${HEAD}, girPath: 5 };\n` },
    { title: "a library that has no GIR file installed", config: `${HEAD}, libraries: ["Absent-1.0"] };\n` },
    {
        title: "a GIR file that is not well-formed XML",
        config: `${HEAD}, libraries: ["InvalidXml-1.0"], girPath: ${JSON.stringify([FIXTURE_GIR])} };\n`,
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
    '"inline_array_corner_get_type", isInline: true, size: 16, fallbackClass: () => Corner }',
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
const PURE = "/* @__PURE__ */";

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

const fixtureLibrariesConfig = (libraries: string[] | undefined): string => {
    const selection = libraries === undefined ? "" : `, libraries: ${JSON.stringify(libraries)}`;

    return config(`${selection}, girPath: ${JSON.stringify([FIXTURE_GIR])}`);
};

const initialRunState = (): CodegenRunState => ({
    project: { root: "", nodeModules: "" },
    status: null,
});

const runInitialCodegen = (state: CodegenRunState, options: Parameters<typeof createCliProject>[0]): void => {
    state.project = createCliProject(options);
    state.status = runCli(state.project, ["codegen"]).status;
};

const withProject = (name: string, source: string, check: (project: CliProject) => void): void => {
    const project = createCliProject({ prefix: `gtkx-cli-codegen-${name}-`, config: source });

    try {
        check(project);
    } finally {
        removeCliProject(project);
    }
};

const generatedModule = (project: CliProject, ...segments: string[]): string =>
    readFileSync(join(project.nodeModules, ".gtkx", ...segments), "utf8");

const storePath = (project: CliProject, ...segments: string[]): string =>
    join(project.nodeModules, ".gtkx", ...segments);

const linkPath = (project: CliProject, ...segments: string[]): string =>
    join(project.nodeModules, "@gtkx", ...segments);

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
    const declared = source.indexOf(`class ${className} `);
    const bound = source.indexOf(`class _${className} `);
    const start = declared === -1 ? bound : declared;
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

export {
    ARRAY_WRITES,
    AXES_EMISSION,
    BROKEN_CASES,
    CAIRO_PACKAGE,
    classBody,
    COMMENT,
    config,
    CORNER_READ,
    CORNER_WRITE,
    DOCUMENTED_MODULE_CASES,
    expectModules,
    expectStoreAndLink,
    fixtureConfig,
    fixtureLibrariesConfig,
    generatedModule,
    GI_MODULES,
    HOVER_CASES,
    HOVER_PROBE,
    hoverDoc,
    initialRunState,
    INLINE_ARRAY_ACCESSORS,
    INLINE_ARRAY_FIELDS,
    INLINE_ELEMENT_DESCRIPTORS,
    isStoreMarked,
    JSX_MODULES,
    LENGTH_BOUNDED_READ,
    linkPath,
    markStore,
    OMITTED_ARRAY_FIELDS,
    OMITTED_FIELD_CASES,
    omittedMentions,
    POINTER_ARRAY_FIELDS,
    POINTER_ARRAY_GETTER,
    PURE,
    RECORD_FIELD_ACCESSORS,
    resolveCairoFrom,
    runInitialCodegen,
    storeManifest,
    storePath,
    VALUE_PARAMETER_BINDINGS,
    VALUE_PARAMETER_DECLARATIONS,
    withProject,
};
