import { readFileSync } from "node:fs";
import { join } from "node:path";

export const DATA_IMPORT_PREFIX = "#data";

export const DATA_IMPORT_KEY: string = `${DATA_IMPORT_PREFIX}/*`;

const CONDITION_PRIORITY = ["default", "import", "node"] as const;

const targetString = (entry: unknown): string | null => {
    if (typeof entry === "string") return entry;
    if (entry !== null && typeof entry === "object" && !Array.isArray(entry)) {
        const conditions = entry as Record<string, unknown>;
        for (const condition of CONDITION_PRIORITY) {
            const value = conditions[condition];
            if (typeof value === "string") return value;
        }
    }
    return null;
};

const DATA_TARGET_PATTERN = /^\.?\/?(.+?)\/\*$/;

const directoryFromTarget = (target: string): string | null => {
    const match = DATA_TARGET_PATTERN.exec(target);
    return match?.[1] ?? null;
};

export const resolveDataDir = (root: string): string | null => {
    let manifest: { imports?: Record<string, unknown> };
    try {
        manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    } catch {
        return null;
    }
    const target = targetString(manifest.imports?.[DATA_IMPORT_KEY]);
    if (target === null) return null;
    return directoryFromTarget(target);
};
