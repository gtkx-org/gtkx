import { isPathInside, isRecord, sortStrings } from "@gtkx/utils";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { DeploySettings } from "../types.js";
import {
    BUILD_MANIFEST_FILENAME,
    BUILD_MANIFEST_FORMAT_VERSION,
    BUILD_MANIFEST_GENERATOR,
    type BuildManifest,
    type RecordedPackage,
} from "../../internal/build-manifest.js";
import {
    assertUniqueSchemaBasenames,
    projectRelativeSchemaPath,
    SCHEMA_SUFFIX,
} from "../../settings/schema.js";

type ResolvedBuildManifest = {
    packages: RecordedPackage[];
    schemaFiles: string[];
};

const invalidManifest = (path: string): Error =>
    new Error(`Cannot deploy: ${path} is not a valid GTKX build manifest. Run \`gtkx build\` again.`);

const recordedSchemas = (value: unknown[], path: string): string[] =>
    value.map((entry) => {
        if (typeof entry !== "string") {
            throw invalidManifest(path);
        }

        return entry;
    });

const recordedPackage = (value: unknown, path: string): RecordedPackage => {
    if (
        !isRecord(value) ||
        typeof value.name !== "string" ||
        typeof value.dir !== "string" ||
        isAbsolute(value.dir) ||
        (value.version !== null && typeof value.version !== "string")
    ) {
        throw invalidManifest(path);
    }

    return { name: value.name, version: value.version, dir: value.dir };
};

const parseBuildManifest = (value: unknown, path: string): BuildManifest => {
    if (
        !isRecord(value) ||
        value.generator !== BUILD_MANIFEST_GENERATOR ||
        value.formatVersion !== BUILD_MANIFEST_FORMAT_VERSION ||
        !Array.isArray(value.schemas) ||
        !Array.isArray(value.packages)
    ) {
        throw invalidManifest(path);
    }

    const packages: unknown[] = value.packages;

    return {
        generator: BUILD_MANIFEST_GENERATOR,
        formatVersion: BUILD_MANIFEST_FORMAT_VERSION,
        schemas: recordedSchemas(value.schemas, path),
        packages: packages.map((entry) => recordedPackage(entry, path)),
    };
};

const isFile = (path: string): boolean => statSync(path, { throwIfNoEntry: false })?.isFile() === true;

const resolveRecordedSchema = (root: string, manifestPath: string, entry: string): string => {
    if (isAbsolute(entry) || !entry.endsWith(SCHEMA_SUFFIX)) {
        throw new Error(`Cannot deploy: ${manifestPath} records an invalid GSettings schema path.`);
    }

    const filePath = resolve(root, entry);

    if (!isPathInside(root, filePath)) {
        throw new Error(`Cannot deploy: ${manifestPath} records a GSettings schema outside the project.`);
    }

    if (!isFile(filePath)) {
        throw new Error(`Cannot deploy: the recorded GSettings schema ${filePath} is missing.`);
    }

    if (projectRelativeSchemaPath(root, filePath) === null) {
        throw new Error(`Cannot deploy: ${manifestPath} records a GSettings schema outside the project.`);
    }

    return filePath;
};

const readBuildManifest = (settings: DeploySettings): ResolvedBuildManifest => {
    const manifestPath = join(settings.paths.dist, BUILD_MANIFEST_FILENAME);

    if (!existsSync(manifestPath)) {
        throw new Error(`Cannot deploy: ${manifestPath} is missing. Run \`gtkx build\` first.`);
    }

    const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    const manifest = parseBuildManifest(parsed, manifestPath);
    const files = manifest.schemas.map((entry) => resolveRecordedSchema(settings.paths.root, manifestPath, entry));
    const unique = sortStrings(new Set(files));
    assertUniqueSchemaBasenames(unique);

    return { packages: manifest.packages, schemaFiles: unique };
};

export { readBuildManifest };
