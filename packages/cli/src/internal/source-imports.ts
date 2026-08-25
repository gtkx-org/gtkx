import type { ParseResult, ParserOptions } from "vite";
import { isRecord, sortStringsBy } from "@gtkx/utils";
import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { parseSync } from "vite";

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

const templateImportSource = (node: Record<string, unknown>): string | null => {
    if (!Array.isArray(node.expressions) || node.expressions.length > 0 || !Array.isArray(node.quasis)) {
        return null;
    }

    const quasis: unknown[] = node.quasis;
    const first: unknown = quasis[0];

    if (!isRecord(first) || !isRecord(first.value)) {
        return null;
    }

    return typeof first.value.cooked === "string" ? first.value.cooked : null;
};

const literalImportSource = (node: unknown): string | null => {
    if (!isRecord(node)) {
        return null;
    }

    if (node.type === "Literal") {
        return typeof node.value === "string" ? node.value : null;
    }

    return node.type === "TemplateLiteral" ? templateImportSource(node) : null;
};

const collectDynamicImportArray = (nodes: unknown[], found: string[]): void => {
    for (const child of nodes) {
        collectDynamicImportSources(child, found);
    }
};

const collectDynamicImportRecord = (node: Record<string, unknown>, found: string[]): void => {
    if (node.type === "ImportExpression") {
        const source = literalImportSource(node.source);

        if (source !== null) {
            found.push(source);
        }

        return;
    }

    collectDynamicImportArray(Object.values(node), found);
};

const collectDynamicImportSources = (node: unknown, found: string[]): void => {
    if (Array.isArray(node)) {
        collectDynamicImportArray(node, found);

        return;
    }

    if (!isRecord(node)) {
        return;
    }

    collectDynamicImportRecord(node, found);
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
    const files: string[] = [];
    sourceFilesIn(dir, files);
    const imports = files.flatMap((path) => importsIn(path));

    return sortStringsBy(imports, importKey);
};

export { discoverSourceImports, parseRuntimeImportsIn, type SourceImport };
