import type { ESTree, ParseResult, ParserOptions } from "vite";
import { sortStringsBy } from "@gtkx/utils";
import { existsSync, globSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { parseSync, Visitor } from "vite";

type SourceImport = {
    importer: string;
    source: string;
};

type SourceLanguage = NonNullable<ParserOptions["lang"]>;
type ParsedModule = ParseResult["module"];

const SOURCE_LANGUAGES: Map<string, SourceLanguage> = new Map([
    [".js", "jsx"],
    [".jsx", "jsx"],
    [".mjs", "jsx"],
    [".mts", "ts"],
    [".ts", "ts"],
    [".tsx", "tsx"],
]);

const GLOBAL_STYLES_SOURCE = "@gtkx/css";
const GLOBAL_STYLES_EXPORT = "injectGlobal";

const SOURCE_ID_RE = /\.(?:[jt]sx?|m[jt]s)(?:\?.*)?$/i;

const sourceLanguage = (path: string): SourceLanguage | undefined => {
    if (path.endsWith(".d.ts") || path.endsWith(".d.mts")) {
        return undefined;
    }

    return SOURCE_LANGUAGES.get(extname(path).toLowerCase());
};

const SOURCE_DIR = "src";

const sourceDirFor = (root: string): string => {
    const sourceDir = join(root, SOURCE_DIR);

    return existsSync(sourceDir) ? sourceDir : root;
};

const discoverSourceFiles = (dir: string): string[] =>
    sortStringsBy(
        globSync("**/{*,.*}", {
            cwd: dir,
            exclude: ["**/{build,coverage,dist,node_modules,out-tsc}/**", "**/.gtkx-output-*/**", "**/.git/**"],
            withFileTypes: true,
        })
            .filter((entry) => entry.isFile())
            .map((entry) => join(entry.parentPath, entry.name))
            .filter((path) => sourceLanguage(path) !== undefined),
        (path) => path,
    );

const staticImportSources = (module: ParsedModule): string[] => [
    ...module.staticImports.map((statement) => statement.moduleRequest.value),
    ...module.staticExports.flatMap((statement) =>
        statement.entries
            .map((entry) => entry.moduleRequest?.value)
            .filter((source): source is string => source !== undefined),
    ),
];

const staticRuntimeImportSources = (module: ParsedModule): string[] => [
    ...module.staticImports
        .filter((statement) => statement.entries.length === 0 || statement.entries.some((entry) => !entry.isType))
        .map((statement) => statement.moduleRequest.value),
    ...module.staticExports.flatMap((statement) =>
        statement.entries
            .filter((entry) => !entry.isType)
            .map((entry) => entry.moduleRequest?.value)
            .filter((source): source is string => source !== undefined),
    ),
];

const templateImportSource = (node: ESTree.TemplateLiteral): string | null => {
    const [quasi] = node.quasis;

    return quasi === undefined || node.expressions.length > 0 ? null : quasi.value.cooked;
};

const literalImportSource = (node: ESTree.Expression): string | null => {
    if (node.type === "TemplateLiteral") {
        return templateImportSource(node);
    }

    return node.type === "Literal" && typeof node.value === "string" ? node.value : null;
};

const collectDynamicImportSources = (program: ESTree.Program, found: string[]): void => {
    new Visitor({
        ImportExpression: (node) => {
            const source = literalImportSource(node.source);

            if (source !== null) {
                found.push(source);
            }
        },
    }).visit(program);
};

const parseSource = (path: string, code: string, lang: SourceLanguage): ParseResult | null => {
    let parsed: ParseResult;

    try {
        parsed = parseSync(path, code, { lang });
    } catch {
        return null;
    }

    return parsed.errors.length > 0 ? null : parsed;
};

const parseSourceWith = (
    path: string,
    code: string,
    staticSources: (module: ParsedModule) => string[],
): SourceImport[] | null => {
    const lang = sourceLanguage(path);

    if (lang === undefined) {
        return [];
    }

    const parsed = parseSource(path, code, lang);

    if (parsed === null) {
        return null;
    }

    const sources = staticSources(parsed.module);

    if (parsed.module.dynamicImports.length > 0) {
        collectDynamicImportSources(parsed.program, sources);
    }

    return [...new Set(sources)].map((source) => ({ importer: path, source }));
};

const readSource = (path: string): string | null => {
    try {
        return readFileSync(path, "utf8");
    } catch {
        return null;
    }
};

const parseImportsInWith = (path: string, staticSources: (module: ParsedModule) => string[]): SourceImport[] | null => {
    if (sourceLanguage(path) === undefined) {
        return [];
    }

    const code = readSource(path);

    return code === null ? null : parseSourceWith(path, code, staticSources);
};

const globalStylesBindings = (module: ParsedModule): Set<string> =>
    new Set(
        module.staticImports
            .filter((statement) => statement.moduleRequest.value === GLOBAL_STYLES_SOURCE)
            .flatMap((statement) => statement.entries)
            .filter((entry) => !entry.isType && entry.importName.name === GLOBAL_STYLES_EXPORT)
            .map((entry) => entry.localName.value),
    );

const withoutPositions = (key: string, value: unknown): unknown =>
    key === "start" || key === "end" ? undefined : value;

const globalStylesIn = (path: string): string | null => {
    const lang = sourceLanguage(path);
    const code = readSource(path);
    const parsed = lang === undefined || code === null ? null : parseSource(path, code, lang);

    if (parsed === null) {
        return null;
    }

    const bindings = globalStylesBindings(parsed.module);
    const injected: unknown[] = [];

    new Visitor({
        CallExpression: (node) => {
            if (node.callee.type === "Identifier" && bindings.has(node.callee.name)) {
                injected.push(node.arguments);
            }
        },
        TaggedTemplateExpression: (node) => {
            if (node.tag.type === "Identifier" && bindings.has(node.tag.name)) {
                injected.push(node.quasi);
            }
        },
    }).visit(parsed.program);

    return JSON.stringify(injected, withoutPositions);
};

const parseImportsIn = (path: string): SourceImport[] | null => parseImportsInWith(path, staticImportSources);

const parseRuntimeImportsIn = (path: string): SourceImport[] | null =>
    parseImportsInWith(path, staticRuntimeImportSources);

const importsIn = (path: string): SourceImport[] => parseImportsIn(path) ?? [];

const importSourcesIn = (path: string, code: string): string[] | null =>
    parseSourceWith(path, code, staticImportSources)?.map((entry) => entry.source) ?? null;

const importKey = (entry: SourceImport): string => `${entry.importer}\0${entry.source}`;

const sortSourceImports = (imports: SourceImport[]): SourceImport[] => sortStringsBy(imports, importKey);

export {
    discoverSourceFiles,
    GLOBAL_STYLES_SOURCE,
    globalStylesIn,
    importSourcesIn,
    importsIn,
    parseRuntimeImportsIn,
    readSource,
    SOURCE_ID_RE,
    sortSourceImports,
    sourceDirFor,
    sourceLanguage,
    type SourceImport,
};
