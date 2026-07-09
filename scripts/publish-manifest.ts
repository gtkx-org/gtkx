import { posix } from "node:path";

export type ExportsField = string | { [key: string]: ExportsField };

export type PackageManifest = {
    name?: string;
    private?: boolean;
    files?: string[];
    bin?: string | { [command: string]: string };
    exports?: ExportsField;
    [field: string]: unknown;
};

const isDevSource = (entry: string): boolean => entry === "src" || entry.startsWith("src/");

const stripExportsSource = (entry: ExportsField): ExportsField => {
    if (typeof entry === "string") return entry;
    const result: { [key: string]: ExportsField } = {};
    for (const [key, value] of Object.entries(entry)) {
        if (key === "source") continue;
        result[key] = stripExportsSource(value);
    }
    return result;
};

export const stripDevArtifacts = (manifest: PackageManifest): PackageManifest => {
    const stripped: PackageManifest = { ...manifest };
    if (manifest.exports !== undefined) {
        stripped.exports = stripExportsSource(manifest.exports);
    }
    return stripped;
};

export const exportsContainSource = (entry: ExportsField): boolean => {
    if (typeof entry === "string") return false;
    return Object.entries(entry).some(([key, value]) => key === "source" || exportsContainSource(value));
};

export const collectExportTargets = (entry: ExportsField): string[] => {
    if (typeof entry === "string") return entry.startsWith("./") ? [entry] : [];
    return Object.values(entry).flatMap(collectExportTargets);
};

const binTargets = (bin: PackageManifest["bin"]): string[] => {
    if (bin === undefined) return [];
    if (typeof bin === "string") return [bin];
    return Object.values(bin);
};

const normalizePath = (path: string): string => path.replace(/^\.\//, "").replace(/^package\//, "");

export type PublishedPackage = {
    name: string;
    entries: string[];
    manifest: PackageManifest;
    maps?: { [path: string]: string };
};

const requiredFileViolations = (files: Set<string>): string[] => {
    const violations: string[] = [];
    if (!files.has("README.md")) violations.push("missing README.md");
    if (!files.has("package.json")) violations.push("missing package.json");
    return violations;
};

const shippedEntryViolation = (entry: string): string | undefined => {
    if (entry.endsWith(".tsbuildinfo")) return `ships build artifact ${entry}`;
    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts") && !isDevSource(entry) && !entry.includes("templates/")) {
        return `ships TypeScript source ${entry}`;
    }
    return undefined;
};

const manifestViolations = (manifest: PackageManifest): string[] => {
    if (manifest.exports !== undefined && exportsContainSource(manifest.exports)) {
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

type SourceMap = {
    sources?: string[];
    sourcesContent?: (string | null)[];
    sourceRoot?: string;
};

const mapSourceViolations = (mapPath: string, content: string, files: Set<string>): string[] => {
    let parsed: SourceMap;
    try {
        parsed = JSON.parse(content) as SourceMap;
    } catch {
        return [`source map ${mapPath} is not valid JSON`];
    }
    const sources = parsed.sources ?? [];
    const sourceRoot = parsed.sourceRoot ?? "";
    const mapDir = posix.dirname(mapPath);
    const violations: string[] = [];
    for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index];
        if (source === undefined) continue;
        if (typeof parsed.sourcesContent?.[index] === "string") continue;
        const resolved = posix.normalize(posix.join(mapDir, sourceRoot, source));
        if (!files.has(resolved)) {
            violations.push(`source map ${mapPath} references missing source ${source}`);
        }
    }
    return violations;
};

const mapViolations = (files: Set<string>, maps: { [path: string]: string }): string[] =>
    Object.entries(maps).flatMap(([path, content]) => mapSourceViolations(normalizePath(path), content, files));

export const assertPublishedShape = ({ name, entries, manifest, maps }: PublishedPackage): void => {
    const files = new Set(entries.map(normalizePath));
    const violations = [
        ...requiredFileViolations(files),
        ...[...files].map(shippedEntryViolation).filter((violation) => violation !== undefined),
        ...manifestViolations(manifest),
        ...unresolvedTargetViolations(files, manifest),
        ...mapViolations(files, maps ?? {}),
    ];
    if (violations.length > 0) {
        throw new Error(`Published package ${name} has an unexpected shape:\n  - ${violations.join("\n  - ")}`);
    }
};
