import { posix } from "node:path";

type ExportsField = string | { [key: string]: ExportsField };

type PackageManifest = {
    name?: string;
    version?: string;
    license?: string;
    private?: boolean;
    files?: string[];
    engines?: { node?: string };
    cpu?: string[];
    os?: string[];
    libc?: string[];
    bin?: string | Record<string, string>;
    main?: string;
    module?: string;
    types?: string;
    typings?: string;
    exports?: ExportsField;
    optionalDependencies?: Record<string, string>;
    [field: string]: unknown;
};

type PublishedPackage = {
    name: string;
    entries: string[];
    manifest: PackageManifest;
    maps?: Record<string, string>;
};

type SourceMap = {
    sources?: string[];
    sourceRoot?: string;
};

const distTagForVersion = (version: string): string => {
    const core = version.split("+", 1)[0] ?? "";
    const dashIndex = core.indexOf("-");

    if (dashIndex === -1) {
        return "latest";
    }

    const identifier = core.slice(dashIndex + 1).split(".", 1)[0] ?? "";

    return identifier === "" || /^\d+$/.test(identifier) ? "next" : identifier;
};

const isDevSource = (entry: string): boolean => entry === "src" || entry.startsWith("src/");

const stripExportsSource = (entry: Record<string, ExportsField>): Record<string, ExportsField> => {
    const result: Record<string, ExportsField> = {};

    for (const [key, value] of Object.entries(entry)) {
        if (key === "source") {
            continue;
        }

        result[key] = typeof value === "string" ? value : stripExportsSource(value);
    }

    return result;
};

const stripDevArtifacts = (manifest: PackageManifest): PackageManifest => {
    const stripped: PackageManifest = { ...manifest };
    const exportsField = manifest.exports;

    if (exportsField !== undefined && typeof exportsField !== "string") {
        stripped.exports = stripExportsSource(exportsField);
    }

    return stripped;
};

const hasSourceCondition = (entry: ExportsField): boolean => {
    if (typeof entry === "string") {
        return false;
    }

    return Object.entries(entry).some(([key, value]) => key === "source" || hasSourceCondition(value));
};

const collectExportTargets = (entry: ExportsField): string[] => {
    if (typeof entry === "string") {
        return entry.startsWith("./") ? [entry] : [];
    }

    return Object.values(entry).flatMap((value) => collectExportTargets(value));
};

const binTargets = (bin: PackageManifest["bin"]): string[] => {
    if (bin === undefined) {
        return [];
    }

    if (typeof bin === "string") {
        return [bin];
    }

    return Object.values(bin);
};

const legacyTargets = (manifest: PackageManifest): [string, string][] => [
    ["main", manifest.main],
    ["module", manifest.module],
    ["types", manifest.types],
    ["typings", manifest.typings],
].filter((entry): entry is [string, string] => typeof entry[1] === "string");

const normalizePath = (path: string): string => path.replace(/^\.\//, "").replace(/^package\//, "");

const isTypescriptSource = (entry: string): boolean =>
    /\.(?:cts|mts|tsx?)$/.test(entry) && !/\.d\.(?:cts|mts|ts)$/.test(entry);

const requiredFileViolations = (files: Set<string>): string[] => {
    const violations: string[] = [];

    if (!files.has("README.md")) {
        violations.push("missing README.md");
    }

    if (!files.has("LICENSE")) {
        violations.push("missing LICENSE");
    }

    if (!files.has("package.json")) {
        violations.push("missing package.json");
    }

    return violations;
};

const shippedEntryViolation = (entry: string): string | undefined => {
    if (entry.endsWith(".tsbuildinfo")) {
        return `ships build artifact ${entry}`;
    }

    if (isTypescriptSource(entry) && !isDevSource(entry) && !entry.includes("templates/")) {
        return `ships TypeScript source ${entry}`;
    }

    return undefined;
};

const manifestViolations = (manifest: PackageManifest): string[] => {
    if (manifest.exports !== undefined && hasSourceCondition(manifest.exports)) {
        return ['package.json "exports" still declares a "source" condition'];
    }

    return [];
};

const identityViolations = (name: string, manifest: PackageManifest): string[] => {
    const violations: string[] = [];

    if (manifest.name !== name) {
        violations.push(`package.json name does not match ${name}`);
    }

    if (typeof manifest.version !== "string" || manifest.version.length === 0) {
        violations.push("package.json has no version");
    }

    return violations;
};

const unresolvedTargetViolations = (files: Set<string>, manifest: PackageManifest): string[] => {
    const exportTargets = manifest.exports === undefined ? [] : collectExportTargets(manifest.exports);

    const missingExports = exportTargets
        .filter((target) => !files.has(normalizePath(target)))
        .map((target) => `export target ${target} resolves to a missing file`);

    const missingBins = binTargets(manifest.bin)
        .filter((target) => !files.has(normalizePath(target)))
        .map((target) => `bin target ${target} resolves to a missing file`);

    const missingLegacyTargets = legacyTargets(manifest)
        .filter(([, target]) => !files.has(normalizePath(target)))
        .map(([field, target]) => `${field} target ${target} resolves to a missing file`);

    return [...missingExports, ...missingBins, ...missingLegacyTargets];
};

const parseSourceMap = (content: string): SourceMap | undefined => {
    try {
        return JSON.parse(content) as SourceMap;
    } catch {
        return undefined;
    }
};

const sourceViolation = (options: {
    parsed: SourceMap;
    source: string;
    mapPath: string;
    files: Set<string>;
}): string | undefined => {
    const { parsed, source, mapPath, files } = options;
    const sourceRoot = parsed.sourceRoot ?? "";
    const resolved = posix.normalize(posix.join(posix.dirname(mapPath), sourceRoot, source));

    if (files.has(resolved)) {
        return undefined;
    }

    return `source map ${mapPath} references missing source ${source}`;
};

const mapSourceViolations = (mapPath: string, content: string, files: Set<string>): string[] => {
    const generatedPath = mapPath.slice(0, -".map".length);

    const generatedViolation = files.has(generatedPath)
        ? []
        : [`source map ${mapPath} has no generated file ${generatedPath}`];

    const parsed = parseSourceMap(content);

    if (parsed === undefined) {
        return [...generatedViolation, `source map ${mapPath} is not valid JSON`];
    }

    const sourceViolations = (parsed.sources ?? [])
        .map((source) => sourceViolation({ parsed, source, mapPath, files }))
        .filter((violation): violation is string => violation !== undefined);

    return [...generatedViolation, ...sourceViolations];
};

const mapViolations = (files: Set<string>, maps: Record<string, string>): string[] =>
    Object.entries(maps).flatMap(([path, content]) => mapSourceViolations(normalizePath(path), content, files));

const assertPublishedShape = ({ name, entries, manifest, maps }: PublishedPackage): void => {
    const files = new Set(entries.map((entry) => normalizePath(entry)));

    const violations = [
        ...requiredFileViolations(files),
        ...[...files].map((file) => shippedEntryViolation(file)).filter((violation) => violation !== undefined),
        ...identityViolations(name, manifest),
        ...manifestViolations(manifest),
        ...unresolvedTargetViolations(files, manifest),
        ...mapViolations(files, maps ?? {}),
    ];

    if (violations.length > 0) {
        throw new Error(`Published package ${name} has an unexpected shape:\n  - ${violations.join("\n  - ")}`);
    }
};

export { assertPublishedShape, distTagForVersion, type PackageManifest, stripDevArtifacts };
