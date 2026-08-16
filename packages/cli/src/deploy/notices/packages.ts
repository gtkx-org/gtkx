import { isRecord, sortStringsBy, warn } from "@gtkx/utils";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DeploySettings } from "../types.js";
import { BUNDLED_PACKAGES_FILENAME } from "../../vite-plugins/bundled-packages.js";
import { type PackageManifest, readPackageManifest } from "../settings/package-manifest.js";
import { copyrightLines, licenseTextIn } from "./text.js";

type RecordedPackage = {
    name: string;
    version: string | null;
    dir: string;
};

type BundledPackage = {
    name: string;
    version: string | null;
    license: string | null;
    source: string | null;
    copyright: string[];
    text: string | null;
    isPresent: boolean;
};

const MANIFEST_FILENAME = "package.json";
const GIT_PREFIX = /^git\+/;
const GIT_SUFFIX = /\.git$/;
const GIT_SCHEME = /^git:\/\//;
const GITHUB_SLUG = /^(?:github:)?(?<slug>[\w.-]+\/[\w.-]+)$/;

const realPath = (path: string): string => {
    try {
        return realpathSync(path);
    } catch {
        return path;
    }
};

const optionalString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const recordedPackage = (entry: unknown): RecordedPackage | null => {
    if (!isRecord(entry) || typeof entry.name !== "string" || typeof entry.dir !== "string") {
        return null;
    }

    return { name: entry.name, version: optionalString(entry.version), dir: entry.dir };
};

const recordedList = (value: unknown): RecordedPackage[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    const entries: unknown[] = value;

    return entries.map((entry) => recordedPackage(entry)).filter((entry) => entry !== null);
};

const readRecordedPackages = (settings: DeploySettings): RecordedPackage[] => {
    const path = join(settings.paths.dist, BUNDLED_PACKAGES_FILENAME);

    if (!existsSync(path)) {
        throw new Error(`Cannot deploy: ${path} is missing. Run \`gtkx build\` first.`);
    }

    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));

    return recordedList(isRecord(parsed) ? parsed.packages : null);
};

const authorLine = (manifest: PackageManifest): string[] => {
    const { name, email } = manifest.author;

    if (name === null) {
        return [];
    }

    return [email === null ? name : `${name} <${email}>`];
};

const sourceUrl = (manifest: PackageManifest): string | null => {
    const configured = manifest.repository ?? manifest.homepage;

    if (configured === null) {
        return null;
    }

    const url = configured.replace(GIT_PREFIX, "").replace(GIT_SUFFIX, "").replace(GIT_SCHEME, "https://");
    const slug = GITHUB_SLUG.exec(url)?.groups?.slug;

    if (slug !== undefined) {
        return `https://github.com/${slug}`;
    }

    return url.startsWith("http") ? url : null;
};

const missingPackage = (entry: RecordedPackage): BundledPackage => ({
    name: entry.name,
    version: entry.version,
    license: null,
    source: null,
    copyright: [],
    text: null,
    isPresent: false,
});

const packageIn = (entry: RecordedPackage, dir: string): BundledPackage => {
    if (!existsSync(join(dir, MANIFEST_FILENAME))) {
        return missingPackage(entry);
    }

    const manifest = readPackageManifest(dir);
    const text = licenseTextIn(dir);
    const copyright = copyrightLines(text);

    return {
        name: manifest.name ?? entry.name,
        version: manifest.version ?? entry.version,
        license: manifest.license,
        source: sourceUrl(manifest),
        copyright: copyright.length === 0 ? authorLine(manifest) : copyright,
        text,
        isPresent: true,
    };
};

const keyFor = (entry: BundledPackage): string => `${entry.name}@${entry.version ?? ""}`;

const dedupe = (entries: BundledPackage[]): BundledPackage[] => {
    const unique: Map<string, BundledPackage> = new Map();

    for (const entry of entries) {
        unique.set(keyFor(entry), entry);
    }

    return sortStringsBy(unique.values(), keyFor);
};

const warnMissing = (entries: BundledPackage[]): void => {
    const missing = entries.filter((entry) => !entry.isPresent);

    if (missing.length === 0) {
        return;
    }

    warn(
        `The third-party notices name ${missing.map((entry) => keyFor(entry)).join(", ")} without any license: ` +
        "`gtkx build` recorded where each package was installed and those directories are no longer there. " +
        "Deploy from the tree the build ran in, or build again, so the notices carry their terms.",
    );
};

const bundledPackages = (settings: DeploySettings): BundledPackage[] => {
    const root = realPath(settings.paths.root);

    const entries = readRecordedPackages(settings)
        .map((entry) => ({ entry, dir: resolve(settings.paths.dist, entry.dir) }))
        .filter(({ dir }) => realPath(dir) !== root)
        .map(({ entry, dir }) => packageIn(entry, dir));

    const bundled = dedupe(entries);
    warnMissing(bundled);

    return bundled;
};

export { type BundledPackage, bundledPackages };
