import { isRecord, sortStrings } from "@gtkx/utils";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { DeploySettings } from "../types.js";
import {
    assertUniqueSchemaBasenames,
    projectRelativeSchemaPath,
    SCHEMA_MANIFEST_FILENAME,
    SCHEMA_SUFFIX,
} from "../../settings/schema.js";

const recordedSchemas = (value: unknown, path: string): string[] => {
    if (!isRecord(value) || !Array.isArray(value.schemas)) {
        throw new Error(`Cannot deploy: ${path} is not a valid GTKX schema manifest. Run \`gtkx build\` again.`);
    }

    const schemas: unknown[] = value.schemas;

    if (schemas.some((entry) => typeof entry !== "string")) {
        throw new Error(`Cannot deploy: ${path} is not a valid GTKX schema manifest. Run \`gtkx build\` again.`);
    }

    return schemas.filter((entry): entry is string => typeof entry === "string");
};

const isFile = (path: string): boolean => {
    try {
        return statSync(path, { throwIfNoEntry: false })?.isFile() === true;
    } catch {
        return false;
    }
};

const isInsideProject = (root: string, filePath: string): boolean => {
    const rel = relative(root, filePath);

    return rel.length > 0 && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

const resolveRecordedSchema = (root: string, manifestPath: string, entry: string): string => {
    if (isAbsolute(entry) || !entry.endsWith(SCHEMA_SUFFIX)) {
        throw new Error(`Cannot deploy: ${manifestPath} records an invalid GSettings schema path.`);
    }

    const filePath = resolve(root, entry);

    if (!isInsideProject(root, filePath)) {
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

const readSchemaManifest = (settings: DeploySettings): string[] => {
    const manifestPath = join(settings.paths.dist, SCHEMA_MANIFEST_FILENAME);

    if (!existsSync(manifestPath)) {
        throw new Error(`Cannot deploy: ${manifestPath} is missing. Run \`gtkx build\` first.`);
    }

    const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    const recorded = recordedSchemas(parsed, manifestPath);
    const files = recorded.map((entry) => resolveRecordedSchema(settings.paths.root, manifestPath, entry));
    const unique = sortStrings(new Set(files));
    assertUniqueSchemaBasenames(unique);

    return unique;
};

export { readSchemaManifest };
