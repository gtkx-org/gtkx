import type { Config } from "@gtkx/config";
import { isPathInside, sortStrings, toPosixPath } from "@gtkx/utils";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { DeploySettings } from "../types.js";
import {
    BUILD_MANIFEST_FILENAME,
    type BuildManifest,
    buildManifestSchema,
    configDigest,
    type RecordedPackage,
} from "../../internal/build-manifest.js";
import { assertUniqueSchemaBasenames, projectRelativeSchemaPath, SCHEMA_SUFFIX } from "../../settings/schema.js";

type ResolvedBuildManifest = {
    packages: RecordedPackage[];
    schemaFiles: string[];
};

type ExpectedBuildConfig = {
    config: Config;
    configFile: string;
};

const invalidManifest = (path: string): Error =>
    new Error(`Cannot deploy: ${path} is not a valid GTKX build manifest. Run \`gtkx build\` again.`);

const parseBuildManifest = (value: unknown, path: string): BuildManifest => {
    const result = buildManifestSchema.safeParse(value);

    if (!result.success) {
        throw invalidManifest(path);
    }

    return result.data;
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

const assertBuildConfig = (
    settings: DeploySettings,
    manifestPath: string,
    manifest: BuildManifest,
    expected: ExpectedBuildConfig,
): void => {
    const expectedFile = toPosixPath(relative(settings.paths.root, expected.configFile));

    if (manifest.configFile !== expectedFile || manifest.configDigest !== configDigest(expected.config)) {
        throw new Error(`Cannot deploy: ${manifestPath} was built from a different GTKX configuration.`);
    }
};

const readBuildManifest = (settings: DeploySettings, expected: ExpectedBuildConfig): ResolvedBuildManifest => {
    const manifestPath = join(settings.paths.dist, BUILD_MANIFEST_FILENAME);

    if (!existsSync(manifestPath)) {
        throw new Error(`Cannot deploy: ${manifestPath} is missing. Run \`gtkx build\` first.`);
    }

    const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    const manifest = parseBuildManifest(parsed, manifestPath);
    assertBuildConfig(settings, manifestPath, manifest, expected);
    const files = manifest.schemas.map((entry) => resolveRecordedSchema(settings.paths.root, manifestPath, entry));
    const unique = sortStrings(new Set(files));
    assertUniqueSchemaBasenames(unique);

    return { packages: manifest.packages, schemaFiles: unique };
};

export { readBuildManifest };
