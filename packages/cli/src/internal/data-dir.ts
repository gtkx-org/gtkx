import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { inspectProjectPath } from "./project-path.js";

const DATA_IMPORT_PREFIX = "#data";
const DATA_IMPORT_KEY = `${DATA_IMPORT_PREFIX}/*`;
const CONDITION_PRIORITY = ["default", "import", "node"] as const;
const DATA_TARGET_PATTERN = /^\.\/(.+)\/\*$/;

const isInvalidDirectorySegment = (segment: string): boolean =>
    segment.length === 0 || segment === "." || segment === "..";

const isConditionMap = (entry: unknown): entry is Record<string, unknown> =>
    entry !== null && typeof entry === "object" && !Array.isArray(entry);

const conditionTarget = (conditions: Record<string, unknown>): string | null => {
    for (const condition of CONDITION_PRIORITY) {
        const value = conditions[condition];

        if (typeof value === "string") {
            return value;
        }
    }

    return null;
};

const targetString = (entry: unknown): string | null => {
    if (typeof entry === "string") {
        return entry;
    }

    if (isConditionMap(entry)) {
        return conditionTarget(entry);
    }

    return null;
};

const directoryFromTarget = (target: string): string | null => {
    const match = DATA_TARGET_PATTERN.exec(target);
    const directory = match?.[1];

    if (
        directory === undefined ||
        directory.includes("\\") ||
        directory.split("/").some((segment) => isInvalidDirectorySegment(segment))
    ) {
        return null;
    }

    return directory;
};

const readManifest = (root: string): unknown => {
    try {
        return JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    } catch {
        return null;
    }
};

const dataTarget = (manifest: unknown): string | null => {
    if (!isConditionMap(manifest) || !isConditionMap(manifest.imports)) {
        return null;
    }

    return targetString(manifest.imports[DATA_IMPORT_KEY]);
};

const resolveDataDir = (root: string): string | null => {
    const target = dataTarget(readManifest(root));

    if (target === null) {
        return null;
    }

    const directory = directoryFromTarget(target);

    if (directory === null) {
        throw new Error(`${DATA_IMPORT_KEY} must target a project-relative directory such as "./data/*"`);
    }

    const path = resolve(root, directory);
    const stats = inspectProjectPath({ root, candidate: path, configured: target, subject: "data directory" });

    if (stats !== undefined && !stats.isDirectory()) {
        throw new Error(`${DATA_IMPORT_KEY} must target a directory below ${root}`);
    }

    return directory;
};

export { DATA_IMPORT_PREFIX, resolveDataDir };
