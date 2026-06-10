import { type Dirent, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { type ParsedSchemaFile, parseSchemaXml, SchemaParseError } from "./parser.js";
import { renderEnvModule } from "./render.js";

const SCHEMA_SUFFIX = ".gschema.xml";

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(["node_modules", "dist", "out-tsc", "coverage"]);

/**
 * Result of {@link emitSchemaEnv}.
 */
export type SchemaEnvResult = {
    /** Absolute path of the emitted `env.d.ts`. */
    readonly path: string;
    /** Absolute paths of the `.gschema.xml` files the emission covered. */
    readonly schemaFiles: readonly string[];
    /** Whether the file's content changed on disk. */
    readonly written: boolean;
};

/**
 * Finds every `.gschema.xml` file under a project root, skipping
 * `node_modules`, build output, and hidden directories.
 *
 * @param rootDir - Absolute path of the project root
 * @returns Absolute file paths in deterministic (sorted) order
 */
export const findSchemaFiles = (rootDir: string): string[] => {
    const found: string[] = [];
    const walk = (dir: string): void => {
        let entries: Dirent[];
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name.startsWith(".")) continue;
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(full);
            } else if (entry.isFile() && entry.name.endsWith(SCHEMA_SUFFIX)) {
                found.push(full);
            }
        }
    };
    walk(rootDir);
    return found.sort((a, b) => a.localeCompare(b));
};

/**
 * Absolute path of the generated schema declaration file for a project: the
 * app-local `node_modules/.gtkx/env.d.ts` that the scaffolded
 * `src/gtkx-env.d.ts` references by relative path.
 *
 * @param rootDir - Absolute path of the project root
 */
export const schemaEnvPath = (rootDir: string): string => join(rootDir, "node_modules", ".gtkx", "env.d.ts");

const parseProjectSchemas = (schemaFiles: readonly string[]): ParsedSchemaFile[] => {
    const sourceByBasename = new Map<string, string>();
    const parsed: ParsedSchemaFile[] = [];
    for (const filePath of schemaFiles) {
        const fileName = basename(filePath);
        const existing = sourceByBasename.get(fileName);
        if (existing !== undefined) {
            throw new Error(
                `Duplicate GSettings schema file name "${fileName}" (${existing} and ${filePath}). ` +
                    "Schema module types are matched on the file name, so every .gschema.xml in a project must be named uniquely.",
            );
        }
        sourceByBasename.set(fileName, filePath);
        try {
            parsed.push(parseSchemaXml(readFileSync(filePath, "utf-8"), fileName));
        } catch (error) {
            if (!(error instanceof SchemaParseError)) throw error;
            console.warn(`[gtkx] Skipping ${filePath} in schema type generation: ${error.message}`);
        }
    }
    return parsed;
};

const writeIfChanged = (path: string, content: string): boolean => {
    let existing: string | null = null;
    try {
        existing = readFileSync(path, "utf-8");
    } catch {
        existing = null;
    }
    if (existing === content) return false;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    return true;
};

/**
 * Generates the project's schema declaration file
 * (`node_modules/.gtkx/env.d.ts`) from every `.gschema.xml` under the
 * project root.
 *
 * The file is written only when its content changes, so repeated emission is
 * cheap and does not churn TypeScript watch processes. A project with no
 * schema files still gets the (empty) file, keeping the scaffolded
 * `/// <reference path>` resolvable. Files that fail to parse are skipped
 * with a warning; two schema files sharing a basename are an error, since
 * module types are matched on the file name.
 *
 * @param rootDir - Absolute path of the project root
 * @returns The {@link SchemaEnvResult}
 */
export const emitSchemaEnv = (rootDir: string): SchemaEnvResult => {
    const schemaFiles = findSchemaFiles(rootDir);
    const content = renderEnvModule(parseProjectSchemas(schemaFiles));
    const path = schemaEnvPath(rootDir);
    const written = writeIfChanged(path, content);
    return { path, schemaFiles, written };
};
