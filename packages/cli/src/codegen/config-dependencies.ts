import { parseSync, traverse, types } from "@babel/core";
import { parseJSON, parseJSON5, parseJSONC, parseTOML, parseYAML } from "confbox";
import { createJiti, type Jiti } from "jiti";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODULE_EXTENSIONS: ReadonlySet<string> = new Set([
    ".cjs",
    ".cts",
    ".js",
    ".mjs",
    ".mts",
    ".ts",
]);
const RESOLVABLE_EXTENSIONS = [
    ".js",
    ".ts",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
    ".json",
    ".jsonc",
    ".json5",
    ".yaml",
    ".yml",
    ".toml",
];
const JAVASCRIPT_FALLBACKS: Readonly<Record<string, string[]>> = {
    ".cjs": [".cts"],
    ".js": [".ts"],
    ".jsx": [".tsx"],
    ".mjs": [".mts"],
};
const DATA_PARSERS: Readonly<Record<string, (source: string) => unknown>> = {
    ".json": parseJSON,
    ".json5": parseJSON5,
    ".jsonc": parseJSONC,
    ".toml": parseTOML,
    ".yaml": parseYAML,
    ".yml": parseYAML,
};

type PackageImports = { file: string; imports: Record<string, unknown>; root: string };
type ModuleSources = { all: string[]; extended: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const parserPlugins = (path: string): ("decorators" | "jsx" | "typescript")[] => {
    const extension = extname(path).toLowerCase();

    return [
        "decorators",
        ...([".cts", ".mts", ".ts"].includes(extension) ? ["typescript" as const] : []),
    ];
};

function expressionSources(value: types.Expression): string[] {
    if (types.isStringLiteral(value)) {
        return [value.value];
    }

    if (types.isArrayExpression(value)) {
        return value.elements.flatMap((element) =>
            types.isExpression(element) ? expressionSources(element) : []);
    }

    return types.isObjectExpression(value)
        ? value.properties.flatMap((property) => sourcePropertySources(property))
        : [];
}

const isNamedProperty = (property: types.ObjectProperty, name: string): boolean =>
    (types.isIdentifier(property.key) && property.key.name === name) ||
    (types.isStringLiteral(property.key) && property.key.value === name);

function sourcePropertySources(
    property: types.ObjectMethod | types.ObjectProperty | types.SpreadElement,
): string[] {
    return types.isObjectProperty(property) &&
        isNamedProperty(property, "source") &&
        types.isExpression(property.value)
        ? expressionSources(property.value)
        : [];
}

const extendsSources = (value: types.Expression): string[] => expressionSources(value);

const isExtendsProperty = (property: types.ObjectProperty): boolean =>
    isNamedProperty(property, "extends");

type ParsedModule = NonNullable<ReturnType<typeof parseSync>>;

const parseModule = (path: string): ParsedModule | undefined => {
    try {
        return parseSync(readFileSync(path, "utf8"), {
            ast: true,
            babelrc: false,
            configFile: false,
            filename: path,
            parserOpts: { allowReturnOutsideFunction: true, plugins: parserPlugins(path) },
            sourceType: "unambiguous",
        }) ?? undefined;
    } catch {
        return undefined;
    }
};

const addSource = (sources: Set<string>, source: types.StringLiteral | null | undefined): void => {
    if (source !== null && source !== undefined) {
        sources.add(source.value);
    }
};

const requireSource = (call: types.CallExpression): types.StringLiteral | undefined =>
    types.isIdentifier(call.callee, { name: "require" }) && types.isStringLiteral(call.arguments[0])
        ? call.arguments[0]
        : undefined;

const importEqualsSource = (declaration: types.TSImportEqualsDeclaration): types.StringLiteral | undefined => {
    const { moduleReference } = declaration;

    return types.isTSExternalModuleReference(moduleReference) ? moduleReference.expression : undefined;
};

const propertySources = (property: types.ObjectProperty): string[] =>
    isExtendsProperty(property) && types.isExpression(property.value)
        ? extendsSources(property.value)
        : [];

const collectModuleSources = (ast: ParsedModule): ModuleSources => {
    const sources: Set<string> = new Set();
    const extended: Set<string> = new Set();

    traverse(ast, {
        CallExpression: (nodePath) => {
            addSource(sources, requireSource(nodePath.node));
        },
        ExportAllDeclaration: (nodePath) => {
            addSource(sources, nodePath.node.source);
        },
        ExportNamedDeclaration: (nodePath) => {
            addSource(sources, nodePath.node.source);
        },
        ImportDeclaration: (nodePath) => {
            addSource(sources, nodePath.node.source);
        },
        ImportExpression: (nodePath) => {
            const { source } = nodePath.node;
            addSource(sources, types.isStringLiteral(source) ? source : undefined);
        },
        ObjectProperty: (nodePath) => {
            for (const source of propertySources(nodePath.node)) {
                sources.add(source);
                extended.add(source);
            }
        },
        TSImportEqualsDeclaration: (nodePath) => {
            addSource(sources, importEqualsSource(nodePath.node));
        },
    });

    return { all: [...sources], extended: [...extended] };
};

const moduleSources = (path: string): ModuleSources => {
    const ast = parseModule(path);

    return ast === undefined ? { all: [], extended: [] } : collectModuleSources(ast);
};

function parsedExtendsSources(value: unknown): string[] {
    if (typeof value === "string") {
        return [value];
    }

    if (Array.isArray(value)) {
        return value.flatMap((item) => parsedExtendsSources(item));
    }

    return objectExtendsSources(value);
}

const objectExtendsSources = (value: unknown): string[] => {
    if (typeof value !== "object" || value === null) {
        return [];
    }

    return "source" in value ? parsedExtendsSources(value.source) : [];
};

const configExtendsSources = (value: unknown): string[] => {
    if (typeof value !== "object" || value === null) {
        return [];
    }

    return "extends" in value ? parsedExtendsSources(value.extends) : [];
};

const dataSources = (path: string): string[] => {
    const parser = DATA_PARSERS[extname(path).toLowerCase()];

    if (parser === undefined) {
        return [];
    }

    try {
        return configExtendsSources(parser(readFileSync(path, "utf8")));
    } catch {
        return [];
    }
};

const extensionCandidates = (path: string): string[] => {
    const extension = extname(path).toLowerCase();

    if (extension.length === 0) {
        return RESOLVABLE_EXTENSIONS.map((candidate) => `${path}${candidate}`);
    }

    const stem = path.slice(0, -extension.length);

    return (JAVASCRIPT_FALLBACKS[extension] ?? []).map((candidate) => `${stem}${candidate}`);
};

const targetCandidates = (target: string, configName: string): string[] => {
    const extension = extname(target);

    if (extension.length > 0) {
        return [target, ...extensionCandidates(target)];
    }

    return [
        target,
        ...extensionCandidates(target),
        join(target, configName),
        ...RESOLVABLE_EXTENSIONS.map((candidate) => join(target, `index${candidate}`)),
    ];
};

const localSourceTarget = (source: string, importer: string): string | undefined => {
    const clean = source.split(/[?#]/u, 1)[0] ?? "";

    if (clean.startsWith("file:")) {
        return fileURLToPath(clean);
    }

    if (!isAbsolute(clean) && !clean.startsWith(".")) {
        return undefined;
    }

    return resolve(dirname(importer), clean);
};

const unresolvedCandidates = (source: string, importer: string, configName: string): string[] => {
    const target = localSourceTarget(source, importer);

    if (target === undefined) {
        return [];
    }

    return targetCandidates(target, configName);
};

const nearestPackageFile = (importer: string): string | undefined => {
    let directory = dirname(importer);
    let previous = "";

    while (directory !== previous) {
        const candidate = join(directory, "package.json");

        if (existsSync(candidate)) {
            return candidate;
        }

        previous = directory;
        directory = dirname(directory);
    }

    return undefined;
};

const readPackageImports = (importer: string): PackageImports | undefined => {
    const file = nearestPackageFile(importer);

    if (file === undefined) {
        return undefined;
    }

    try {
        const manifest = parseJSON(readFileSync(file, "utf8"));

        return isRecord(manifest) && isRecord(manifest.imports)
            ? { file, imports: manifest.imports, root: dirname(file) }
            : undefined;
    } catch {
        return undefined;
    }
};

function stringTargets(value: unknown): string[] {
    if (typeof value === "string") {
        return [value];
    }

    if (Array.isArray(value)) {
        return value.flatMap((item) => stringTargets(item));
    }

    return isRecord(value)
        ? Object.values(value).flatMap((item) => stringTargets(item))
        : [];
}

const importPatternMatch = (pattern: string, source: string): string | undefined => {
    if (pattern === source) {
        return "";
    }

    const wildcard = pattern.indexOf("*");

    if (wildcard === -1) {
        return undefined;
    }

    const prefix = pattern.slice(0, wildcard);
    const suffix = pattern.slice(wildcard + 1);

    return source.startsWith(prefix) && source.endsWith(suffix)
        ? source.slice(prefix.length, source.length - suffix.length)
        : undefined;
};

const packageImportTargets = (source: string, imports: Record<string, unknown>): string[] =>
    Object.entries(imports).flatMap(([pattern, value]) => {
        const match = importPatternMatch(pattern, source);

        return match === undefined
            ? []
            : stringTargets(value).map((target) => target.split("*").join(match));
    });

const packageImportDependencies = (source: string, importer: string, configName: string): string[] => {
    if (!source.startsWith("#")) {
        return [];
    }

    const packageImports = readPackageImports(importer);

    if (packageImports === undefined) {
        return [];
    }

    const targets = packageImportTargets(source, packageImports.imports)
        .filter((target) => target.startsWith("."))
        .flatMap((target) => targetCandidates(resolve(packageImports.root, target), configName));

    return [packageImports.file, ...targets];
};

const normalizedResolvedPath = (path: string): string =>
    path.startsWith("file:") ? fileURLToPath(path) : path;

const resolvedSourcePath = (source: string, importer: string, jiti: Jiti): string | undefined => {
    try {
        const path = jiti.esmResolve(source, {
            parentURL: pathToFileURL(importer).href,
            try: true,
        });

        return path === undefined ? undefined : normalizedResolvedPath(path);
    } catch {
        return undefined;
    }
};

const sourceDependencies = (
    source: string,
    importer: string,
    configName: string,
    jiti: Jiti,
): string[] => {
    const dependency = resolvedSourcePath(source, importer, jiti);
    const packageDependencies = packageImportDependencies(source, importer, configName);

    return dependency === undefined
        ? [...unresolvedCandidates(source, importer, configName), ...packageDependencies]
        : [dependency, ...packageDependencies];
};

const configLayerDirectory = (path: string, configName: string, configRoot: string): string => {
    const segments = configName.split(/[\\/]/u).filter((segment) => segment.length > 0);
    let directory = resolve(path);
    let remaining = segments.length;

    while (remaining > 0) {
        directory = dirname(directory);
        remaining -= 1;
    }

    return resolve(directory, ...segments) === resolve(path) ? directory : resolve(configRoot);
};

const c12SourceDependencies = (
    source: string,
    importer: string,
    configName: string,
    configRoot: string,
): string[] => {
    const clean = source.split(/[?#]/u, 1)[0] ?? "";

    if (clean === "." || (!isAbsolute(clean) && !clean.startsWith("."))) {
        return [];
    }

    const cwd = configLayerDirectory(importer, configName, configRoot);
    const extension = extname(clean);
    const target = (extension.length === 0 || extension === basename(clean))
        ? resolve(cwd, clean, configName)
        : resolve(cwd, clean);

    return targetCandidates(target, configName);
};

const directDependencies = (path: string, configName: string, configRoot: string): string[] => {
    const module = MODULE_EXTENSIONS.has(extname(path).toLowerCase()) ? moduleSources(path) : undefined;
    const sources = module?.all ?? dataSources(path);
    const extended = module?.extended ?? sources;
    const jiti = createJiti(path, {
        extensions: RESOLVABLE_EXTENSIONS,
        fsCache: false,
        moduleCache: false,
    });

    return [
        ...sources.flatMap((source) => sourceDependencies(source, path, configName, jiti)),
        ...extended.flatMap((source) => c12SourceDependencies(source, path, configName, configRoot)),
    ]
        .filter((dependency) => !dependency.includes(`${sep}node_modules${sep}`));
};

const resolveConfigDependencies = (
    configFile: string,
    configName = basename(configFile),
    configRoot = dirname(configFile),
): string[] => {
    const dependencies: Set<string> = new Set();
    const pending = [resolve(configFile)];

    while (pending.length > 0) {
        const path = pending.pop();

        if (path === undefined) {
            break;
        }

        if (dependencies.has(path)) {
            continue;
        }

        dependencies.add(path);
        pending.push(...directDependencies(path, configName, configRoot));
    }

    return [...dependencies];
};

export { resolveConfigDependencies };
