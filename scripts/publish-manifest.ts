import { posix } from "node:path";

type ExportsField = string | { [key: string]: ExportsField };

type PackageManifest = {
    name?: string;
    version?: string;
    private?: boolean;
    files?: string[];
    bin?: string | Record<string, string>;
    exports?: ExportsField;
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
    sourcesContent?: (string | null)[];
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

const normalizePath = (path: string): string => path.replace(/^\.\//, "").replace(/^package\//, "");

const requiredFileViolations = (files: Set<string>): string[] => {
    const violations: string[] = [];

    if (!files.has("README.md")) {
        violations.push("missing README.md");
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

    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts") && !isDevSource(entry) && !entry.includes("templates/")) {
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

const unresolvedTargetViolations = (files: Set<string>, manifest: PackageManifest): string[] => {
    const exportTargets = manifest.exports === undefined ? [] : collectExportTargets(manifest.exports);

    const missingExports = exportTargets
        .filter((target) => !files.has(normalizePath(target)))
        .map((target) => `export target ${target} resolves to a missing file`);

    const missingBins = binTargets(manifest.bin)
        .filter((target) => !files.has(normalizePath(target)))
        .map((target) => `bin target ${target} resolves to a missing file`);

    return [...missingExports, ...missingBins];
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
    index: number;
    mapPath: string;
    files: Set<string>;
}): string | undefined => {
    const { parsed, source, index, mapPath, files } = options;

    if (typeof parsed.sourcesContent?.[index] === "string") {
        return undefined;
    }

    const sourceRoot = parsed.sourceRoot ?? "";
    const resolved = posix.normalize(posix.join(posix.dirname(mapPath), sourceRoot, source));

    if (files.has(resolved)) {
        return undefined;
    }

    return `source map ${mapPath} references missing source ${source}`;
};

const mapSourceViolations = (mapPath: string, content: string, files: Set<string>): string[] => {
    const parsed = parseSourceMap(content);

    if (parsed === undefined) {
        return [`source map ${mapPath} is not valid JSON`];
    }

    return (parsed.sources ?? [])
        .map((source, index) => sourceViolation({ parsed, source, index, mapPath, files }))
        .filter((violation): violation is string => violation !== undefined);
};

const mapViolations = (files: Set<string>, maps: Record<string, string>): string[] =>
    Object.entries(maps).flatMap(([path, content]) => mapSourceViolations(normalizePath(path), content, files));

const assertPublishedShape = ({ name, entries, manifest, maps }: PublishedPackage): void => {
    const files = new Set(entries.map((entry) => normalizePath(entry)));

    const violations = [
        ...requiredFileViolations(files),
        ...[...files].map((file) => shippedEntryViolation(file)).filter((violation) => violation !== undefined),
        ...manifestViolations(manifest),
        ...unresolvedTargetViolations(files, manifest),
        ...mapViolations(files, maps ?? {}),
    ];

    if (violations.length > 0) {
        throw new Error(`Published package ${name} has an unexpected shape:\n  - ${violations.join("\n  - ")}`);
    }
};

export {
    distTagForVersion,
    stripDevArtifacts,
    hasSourceCondition,
    collectExportTargets,
    assertPublishedShape,
    type PackageManifest,
    type PublishedPackage,
};
