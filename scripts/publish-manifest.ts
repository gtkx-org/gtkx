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
    if (manifest.files !== undefined) {
        stripped.files = manifest.files.filter((entry) => !isDevSource(entry));
    }
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
};

const requiredFileViolations = (files: Set<string>): string[] => {
    const violations: string[] = [];
    if (!files.has("README.md")) violations.push("missing README.md");
    if (!files.has("package.json")) violations.push("missing package.json");
    return violations;
};

const shippedEntryViolation = (entry: string): string | undefined => {
    if (isDevSource(entry)) return `ships development source ${entry}`;
    if (entry.endsWith(".tsbuildinfo")) return `ships build artifact ${entry}`;
    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts") && !entry.includes("templates/")) {
        return `ships TypeScript source ${entry}`;
    }
    return undefined;
};

const manifestViolations = (manifest: PackageManifest): string[] => {
    const violations: string[] = [];
    if (manifest.files?.some(isDevSource)) violations.push('package.json "files" still lists a "src" entry');
    if (manifest.exports !== undefined && exportsContainSource(manifest.exports)) {
        violations.push('package.json "exports" still declares a "source" condition');
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
    return [...missingExports, ...missingBins];
};

export const assertPublishedShape = ({ name, entries, manifest }: PublishedPackage): void => {
    const files = new Set(entries.map(normalizePath));
    const violations = [
        ...requiredFileViolations(files),
        ...[...files].map(shippedEntryViolation).filter((violation) => violation !== undefined),
        ...manifestViolations(manifest),
        ...unresolvedTargetViolations(files, manifest),
    ];
    if (violations.length > 0) {
        throw new Error(`Published package ${name} has an unexpected shape:\n  - ${violations.join("\n  - ")}`);
    }
};
