import type { ESTree, ParseResult, ParserOptions } from "vite";
import { sortStringsBy } from "@gtkx/utils";
import { existsSync, globSync, readFileSync, realpathSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { parseSync, Visitor } from "vite";
import { applicationSourcePackages } from "./linked-packages.js";

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

const SOURCE_ID_RE = /\.(?:[jt]sx?|m[jt]s)(?:\?.*)?$/i;
const DECLARATION_FILE_RE = /\.d(?:\.[^./]+)?\.m?ts$/;
const PROJECT_FILE_EXCLUDES = [
    "**/{build,coverage,dist,node_modules,out-tsc}/**",
    "**/.gtkx-output-*/**",
    "**/.git/**",
];

const sourceLanguage = (path: string): SourceLanguage | undefined => {
    if (DECLARATION_FILE_RE.test(path)) {
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
            exclude: PROJECT_FILE_EXCLUDES,
            withFileTypes: true,
        })
            .filter((entry) => entry.isFile())
            .map((entry) => join(entry.parentPath, entry.name))
            .filter((path) => sourceLanguage(path) !== undefined),
        (path) => path,
    );

/**
 * Lists the roots of the workspace packages the application at `root` uses from source (see
 * {@link applicationSourcePackages}), each spelled from `root` so paths relative to the application read as they
 * do in the workspace.
 */
const sourcePackageRoots = (root: string): string[] => {
    const project = realpathSync(root);

    return applicationSourcePackages(project).map((directory) => resolve(root, relative(project, directory)));
};

/**
 * Lists the source directories of the application at `root`: its own, then those of the workspace packages it
 * uses from source.
 */
const projectSourceDirs = (root: string, packages: readonly string[] = sourcePackageRoots(root)): string[] => [
    ...new Set([root, ...packages].map(sourceDirFor)),
];

const discoverSourceFilesIn = (dirs: readonly string[]): string[] =>
    sortStringsBy([...new Set(dirs.flatMap(discoverSourceFiles))], (path) => path);

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

const parseSourceWith = (
    path: string,
    code: string,
    staticSources: (module: ParsedModule) => string[],
): SourceImport[] | null => {
    const lang = sourceLanguage(path);

    if (lang === undefined) {
        return [];
    }

    let parsed: ParseResult;

    try {
        parsed = parseSync(path, code, { lang });
    } catch {
        return null;
    }

    if (parsed.errors.length > 0) {
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
    discoverSourceFilesIn,
    importSourcesIn,
    importsIn,
    parseRuntimeImportsIn,
    PROJECT_FILE_EXCLUDES,
    projectSourceDirs,
    readSource,
    SOURCE_ID_RE,
    sortSourceImports,
    sourceLanguage,
    sourcePackageRoots,
    type SourceImport,
};
