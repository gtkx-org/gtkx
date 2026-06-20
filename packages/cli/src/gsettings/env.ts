import { createHash } from "node:crypto";
import { type Dirent, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { DATA_IMPORT_PREFIX } from "@gtkx/config";
import { sortedAlpha } from "@gtkx/utils";
import { warn } from "../internal/log.js";
import { type ParsedSchemaFile, parseSchemaXml, SchemaParseError } from "./parser.js";
import { renderEnvModule } from "./render.js";

/** Filename suffix every GSettings schema XML file carries. */
export const SCHEMA_SUFFIX = ".gschema.xml";

/**
 * Composes the `GSETTINGS_SCHEMA_DIR` colon-separated search path with `dir`
 * prepended, skipping the prepend when `dir` is already present so a repeated
 * compile does not lengthen the path. Pure: the caller assigns the result to
 * `process.env`.
 *
 * @param dir - The compiled-schema directory to give precedence.
 * @param existing - The current `GSETTINGS_SCHEMA_DIR` value, if any.
 * @returns The composed search path.
 */
export const prependSchemaDir = (dir: string, existing: string | undefined): string => {
    if (existing === undefined || existing.length === 0) return dir;
    if (existing.split(":").includes(dir)) return existing;
    return `${dir}:${existing}`;
};

const STAGED_NAME_LENGTH = 16;

/**
 * A collision-free flat filename under which a schema source is staged for
 * `glib-compile-schemas`. The compiler merges schemas by their internal
 * `<schema id>`, not by filename, so a content-independent hash of the source
 * path keeps same-basename schemas in different subdirectories from clobbering
 * one another in the staging directory.
 *
 * @param filePath - Absolute path of the schema source file
 */
export const stagedSchemaName = (filePath: string): string =>
    `${createHash("sha1").update(filePath).digest("hex").slice(0, STAGED_NAME_LENGTH)}${SCHEMA_SUFFIX}`;

const toForwardSlashes = (value: string): string => value.split(/[/\\]/).join("/");

/** The `#data/<rel>` module specifier a schema file is imported and typed under. */
const moduleSpecifierFor = (dataDirAbs: string, filePath: string): string =>
    `${DATA_IMPORT_PREFIX}/${toForwardSlashes(relative(dataDirAbs, filePath))}`;

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

const readVisibleEntries = (dir: string): Dirent[] => {
    try {
        return readdirSync(dir, { withFileTypes: true }).filter((entry) => !entry.name.startsWith("."));
    } catch {
        return [];
    }
};

const isSchemaFile = (entry: Dirent): boolean => entry.isFile() && entry.name.endsWith(SCHEMA_SUFFIX);

/**
 * Finds every `.gschema.xml` file under the given data directory, descending
 * into its visible subdirectories. Returns an empty list when the directory
 * does not exist.
 *
 * @param dataDir - Absolute path of the project's data directory
 * @returns Absolute file paths in deterministic (sorted) order
 */
export const findSchemaFiles = (dataDir: string): string[] => {
    const found: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of readVisibleEntries(dir)) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (isSchemaFile(entry)) {
                found.push(full);
            }
        }
    };
    walk(dataDir);
    return sortedAlpha(found);
};

/**
 * Absolute path of the generated schema declaration file for a project: the
 * app-local `node_modules/.gtkx/env.d.ts` that the scaffolded
 * `src/gtkx-env.d.ts` references by relative path.
 *
 * @param rootDir - Absolute path of the project root
 */
export const schemaEnvPath = (rootDir: string): string => join(rootDir, "node_modules", ".gtkx", "env.d.ts");

const parseProjectSchemas = (schemaFiles: readonly string[], dataDirAbs: string): ParsedSchemaFile[] => {
    const parsed: ParsedSchemaFile[] = [];
    for (const filePath of schemaFiles) {
        const specifier = moduleSpecifierFor(dataDirAbs, filePath);
        try {
            parsed.push(parseSchemaXml(readFileSync(filePath, "utf-8"), specifier));
        } catch (error) {
            if (!(error instanceof SchemaParseError)) throw error;
            warn(`Skipping ${filePath} in schema type generation: ${error.message}`);
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
 * project's data directory.
 *
 * The file is written only when its content changes, so repeated emission is
 * cheap and does not churn TypeScript watch processes. A project with no
 * schema files (or no `#data/*` import configured) still gets the (empty)
 * file, keeping the scaffolded `/// <reference path>` resolvable. Each schema
 * is typed under its exact `#data/<rel>` module specifier; files that fail to
 * parse are skipped with a warning.
 *
 * @param rootDir - Absolute path of the project root
 * @param dataDir - Project-relative data directory to scan, or `null` when unconfigured
 * @returns The {@link SchemaEnvResult}
 */
export const emitSchemaEnv = (rootDir: string, dataDir: string | null): SchemaEnvResult => {
    const dataDirAbs = dataDir === null ? null : join(rootDir, dataDir);
    const schemaFiles = dataDirAbs === null ? [] : findSchemaFiles(dataDirAbs);
    const parsed = dataDirAbs === null ? [] : parseProjectSchemas(schemaFiles, dataDirAbs);
    const content = renderEnvModule(parsed);
    const path = schemaEnvPath(rootDir);
    const written = writeIfChanged(path, content);
    return { path, schemaFiles, written };
};
