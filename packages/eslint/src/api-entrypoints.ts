import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Manifest = {
    exports?: Record<string, unknown>;
    name?: string;
};

type PackageEntry = {
    dir: string;
    manifest: Manifest;
};

type ResolvedEntrypoint = {
    dir: string;
    name: string;
    path: string;
};

const readManifest = (dir: string): Manifest | undefined => {
    const file = join(dir, "package.json");

    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Manifest) : undefined;
};

const readPackageDirs = (root: string): string[] => {
    const packages = join(root, "packages");
    const entries = readdirSync(packages, { withFileTypes: true });

    return entries.filter((entry) => entry.isDirectory()).map((entry) => join(packages, entry.name));
};

const manifestsFor = (root: string): Map<string, PackageEntry> => {
    const found: Map<string, PackageEntry> = new Map();

    for (const dir of readPackageDirs(root)) {
        const manifest = readManifest(dir);
        const name = manifest?.name;

        if (manifest !== undefined && name !== undefined) {
            found.set(name, { dir, manifest });
        }
    }

    return found;
};

const splitSpecifier = (specifier: string): { name: string; subpath: string } => {
    const segments = specifier.split("/");
    const scoped = segments.slice(0, 2).join("/");
    const name = specifier.startsWith("@") ? scoped : (segments[0] ?? specifier);

    return { name, subpath: `.${specifier.slice(name.length)}` };
};

const readCondition = (value: unknown, condition: string): string | undefined => {
    if (typeof value === "string") {
        return value;
    }

    const conditions = value as Record<string, unknown> | null;
    const target = typeof conditions === "object" && conditions !== null ? conditions[condition] : undefined;

    return typeof target === "string" ? target : undefined;
};

const resolveEntrypoints = (root: string, entrypoints: string[], condition: string): ResolvedEntrypoint[] => {
    const packages = manifestsFor(root);

    return entrypoints.flatMap((specifier) => {
        const { name, subpath } = splitSpecifier(specifier);
        const entry = packages.get(name);
        const path = readCondition(entry?.manifest.exports?.[subpath], condition);

        return entry === undefined || path === undefined ? [] : [{ dir: entry.dir, name, path }];
    });
};

export { resolveEntrypoints };
