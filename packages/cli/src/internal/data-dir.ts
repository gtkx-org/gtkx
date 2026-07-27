import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATA_IMPORT_PREFIX = "#data";
const DATA_IMPORT_KEY = `${DATA_IMPORT_PREFIX}/*`;
const CONDITION_PRIORITY = ["default", "import", "node"] as const;
const DATA_TARGET_PATTERN = /^\.?\/?(.+?)\/\*$/;

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

    return match?.[1] ?? null;
};

const resolveDataDir = (root: string): string | null => {
    let manifest: unknown;

    try {
        manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    } catch {
        return null;
    }

    if (!isConditionMap(manifest)) {
        return null;
    }

    const imports = manifest.imports;

    if (!isConditionMap(imports)) {
        return null;
    }

    const target = targetString(imports[DATA_IMPORT_KEY]);

    if (target === null) {
        return null;
    }

    return directoryFromTarget(target);
};

export { DATA_IMPORT_PREFIX, resolveDataDir };
