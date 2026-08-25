type RecordedPackage = {
    name: string;
    version: string | null;
    dir: string;
};

type BuildManifest = {
    generator: typeof BUILD_MANIFEST_GENERATOR;
    formatVersion: typeof BUILD_MANIFEST_FORMAT_VERSION;
    schemas: string[];
    packages: RecordedPackage[];
};

type BuildManifestCollector = {
    schemas: string[];
};

const BUILD_MANIFEST_FILENAME = "gtkx-schemas.json";
const BUILD_MANIFEST_GENERATOR = "gtkx-build";
const BUILD_MANIFEST_FORMAT_VERSION = 1;

const createBuildManifestCollector = (): BuildManifestCollector => ({ schemas: [] });

export {
    BUILD_MANIFEST_FILENAME,
    BUILD_MANIFEST_FORMAT_VERSION,
    BUILD_MANIFEST_GENERATOR,
    createBuildManifestCollector,
    type BuildManifest,
    type BuildManifestCollector,
    type RecordedPackage,
};
