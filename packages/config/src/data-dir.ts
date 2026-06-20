import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Node subpath-import prefix every bundled-data import is rooted at.
 * An app declares where it points with a `package.json` `imports` entry —
 * `{ "imports": { "#data/*": "./data/*" } }` — which Node, Vite, and
 * TypeScript all resolve natively, and which GTKX reads back to locate the
 * directory holding GResource assets and GSettings schemas.
 */
export const DATA_IMPORT_PREFIX = "#data";

/** The `imports` key GTKX reads to locate the data directory. */
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

/**
 * Resolves the project-relative data directory from a package.json
 * `imports` map, reading the {@link DATA_IMPORT_KEY} entry.
 *
 * `{ "imports": { "#data/*": "./data/*" } }` yields `"data"`. Returns `null`
 * when the project has no `package.json`, no `#data/*` entry, or an entry
 * whose target is not a `./<dir>/*` glob — in which case `#data/` imports do
 * not resolve and no data directory is scanned.
 *
 * @param root - Absolute path of the project root
 * @returns The project-relative data directory, or `null` when unconfigured
 */
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
