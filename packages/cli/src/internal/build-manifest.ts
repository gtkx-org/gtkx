import { createHash } from "node:crypto";
import { z } from "zod";

type RecordedPackage = z.infer<typeof recordedPackageSchema>;
type BuildManifest = z.infer<typeof buildManifestSchema>;

type BuildManifestCollector = {
    schemas: string[];
};

const BUILD_MANIFEST_FILENAME = "gtkx-schemas.json";
const BUILD_NOTICES_FILENAME = "BUNDLED-NOTICES";
const BUILD_METADATA_FILENAMES: ReadonlySet<string> = new Set([BUILD_MANIFEST_FILENAME, BUILD_NOTICES_FILENAME]);
const BUILD_MANIFEST_GENERATOR = "gtkx-build";
const BUILD_MANIFEST_FORMAT_VERSION = 4;

const recordedPackageSchema = z.object({
    name: z.string(),
    version: z.string().nullable(),
    license: z.string().nullable(),
    source: z.string().nullable(),
    copyright: z.array(z.string()),
    text: z.string().nullable(),
});

const buildManifestSchema = z.object({
    generator: z.literal(BUILD_MANIFEST_GENERATOR),
    formatVersion: z.literal(BUILD_MANIFEST_FORMAT_VERSION),
    configFile: z.string(),
    configDigest: z.string(),
    schemas: z.array(z.string()),
    packages: z.array(recordedPackageSchema),
});

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
    createHash("sha256")
        .update(JSON.stringify(canonicalConfig(config)))
        .digest("hex");

const createBuildManifestCollector = (): BuildManifestCollector => ({ schemas: [] });

export {
    BUILD_MANIFEST_FILENAME,
    BUILD_METADATA_FILENAMES,
    BUILD_NOTICES_FILENAME,
    BUILD_MANIFEST_FORMAT_VERSION,
    BUILD_MANIFEST_GENERATOR,
    buildManifestSchema,
    configDigest,
    createBuildManifestCollector,
    type BuildManifest,
    type BuildManifestCollector,
    type RecordedPackage,
};
