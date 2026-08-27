import type { ESTree, ParseResult, ParserOptions } from "vite";
import { sortStringsBy } from "@gtkx/utils";
import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { parseSync, Visitor } from "vite";

type SourceImport = {
    importer: string;
    source: string;
};

type SourceLanguage = NonNullable<ParserOptions["lang"]>;
type ParsedModule = ParseResult["module"];

const SOURCE_LANGUAGES: Map<string, SourceLanguage> = new Map([
    [".cjs", "jsx"],
    [".cts", "ts"],
    [".js", "jsx"],
    [".jsx", "jsx"],
    [".mjs", "jsx"],
    [".mts", "ts"],
    [".ts", "ts"],
    [".tsx", "tsx"],
]);

const EXCLUDED_DIRECTORIES: Set<string> = new Set([
    ".git",
    ".gtkx",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "out-tsc",
]);

const sourceLanguage = (path: string): SourceLanguage | undefined => {
    if (path.endsWith(".d.ts") || path.endsWith(".d.cts") || path.endsWith(".d.mts")) {
        return undefined;
    }

    return SOURCE_LANGUAGES.get(extname(path).toLowerCase());
};

const collectSourceEntry = (dir: string, entry: Dirent, found: string[]): void => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
            sourceFilesIn(path, found);
        }

        return;
    }

    if (entry.isFile() && sourceLanguage(path) !== undefined) {
        found.push(path);
    }
};

const sourceFilesIn = (dir: string, found: string[]): void => {
    let entries: Dirent[];

    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        collectSourceEntry(dir, entry, found);
    }
};

const discoverSourceFiles = (dir: string): string[] => {
    const files: string[] = [];
    sourceFilesIn(dir, files);

    return sortStringsBy(files, (path) => path);
};

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

const parseImportsInWith = (
    path: string,
    staticSources: (module: ParsedModule) => string[],
): SourceImport[] | null => {
    const lang = sourceLanguage(path);

    if (lang === undefined) {
        return [];
    }

    let parsed: ParseResult;

    try {
        parsed = parseSync(path, readFileSync(path, "utf8"), { lang });
    } catch {
        return null;
    }

    if (parsed.errors.length > 0) {
        return null;
    }

    const sources = staticSources(parsed.module);
    collectDynamicImportSources(parsed.program, sources);

    return [...new Set(sources)].map((source) => ({ importer: path, source }));
};

const parseImportsIn = (path: string): SourceImport[] | null => parseImportsInWith(path, staticImportSources);

const parseRuntimeImportsIn = (path: string): SourceImport[] | null =>
    parseImportsInWith(path, staticRuntimeImportSources);

const importsIn = (path: string): SourceImport[] => parseImportsIn(path) ?? [];
const importKey = (entry: SourceImport): string => `${entry.importer}\0${entry.source}`;

const discoverSourceImports = (dir: string): SourceImport[] => {
    const files = discoverSourceFiles(dir);
    const imports = files.flatMap((path) => importsIn(path));

    return sortStringsBy(imports, importKey);
};

export { discoverSourceFiles, discoverSourceImports, parseRuntimeImportsIn, type SourceImport, sourceLanguage };
