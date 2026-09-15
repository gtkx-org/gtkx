import { createHash } from "node:crypto";

type RecordedPackage = {
    name: string;
    version: string | null;
    license: string | null;
    source: string | null;
    copyright: string[];
    text: string | null;
};

type BuildManifest = {
    generator: typeof BUILD_MANIFEST_GENERATOR;
    formatVersion: typeof BUILD_MANIFEST_FORMAT_VERSION;
    configFile: string;
    configDigest: string;
    schemas: string[];
    packages: RecordedPackage[];
};

type BuildManifestCollector = {
    schemas: string[];
};

const BUILD_MANIFEST_FILENAME = "gtkx-schemas.json";
const BUILD_NOTICES_FILENAME = "BUNDLED-NOTICES";
const BUILD_METADATA_FILENAMES: ReadonlySet<string> = new Set([BUILD_MANIFEST_FILENAME, BUILD_NOTICES_FILENAME]);
const BUILD_MANIFEST_GENERATOR = "gtkx-build";
const BUILD_MANIFEST_FORMAT_VERSION = 3;

const canonicalConfig = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map((entry) => canonicalConfig(entry));
    }

    if (typeof value !== "object" || value === null) {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value)
            .toSorted(([left], [right]) => left.localeCompare(right))
            .map(([key, entry]) => [key, canonicalConfig(entry)]),
    );
};

const configDigest = (config: unknown): string =>
    createHash("sha256").update(JSON.stringify(canonicalConfig(config))).digest("hex");

const createBuildManifestCollector = (): BuildManifestCollector => ({ schemas: [] });

export {
    BUILD_MANIFEST_FILENAME,
    BUILD_METADATA_FILENAMES,
    BUILD_NOTICES_FILENAME,
    BUILD_MANIFEST_FORMAT_VERSION,
    BUILD_MANIFEST_GENERATOR,
    configDigest,
    createBuildManifestCollector,
    type BuildManifest,
    type BuildManifestCollector,
    type RecordedPackage,
};
