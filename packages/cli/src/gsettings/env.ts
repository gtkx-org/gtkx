import { createHash } from "node:crypto";
import { copyFileSync, type Dirent, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { DATA_IMPORT_PREFIX } from "@gtkx/config";
import { sortedAlpha } from "@gtkx/utils";
import { warn } from "../internal/log.js";
import { type ParsedSchemaFile, parseSchemaXml, SchemaParseError } from "./parser.js";
import { renderEnvModule } from "./render.js";

export const SCHEMA_SUFFIX = ".gschema.xml";

export const prependSchemaDir = (dir: string, existing: string | undefined): string => {
    if (existing === undefined || existing.length === 0) return dir;
    if (existing.split(":").includes(dir)) return existing;
    return `${dir}:${existing}`;
};

const STAGED_NAME_LENGTH = 16;

const stagedSchemaName = (filePath: string): string =>
    `${createHash("sha1").update(filePath).digest("hex").slice(0, STAGED_NAME_LENGTH)}${SCHEMA_SUFFIX}`;

export const stageSchema = (dir: string, filePath: string): void => {
    copyFileSync(filePath, join(dir, stagedSchemaName(filePath)));
};

const toForwardSlashes = (value: string): string => value.replaceAll(/[/\\]/g, "/");

const moduleSpecifierFor = (dataDirAbs: string, filePath: string): string =>
    `${DATA_IMPORT_PREFIX}/${toForwardSlashes(relative(dataDirAbs, filePath))}`;

export type SchemaEnvResult = {
    path: string;
    schemaFiles: string[];
    written: boolean;
};

const readVisibleEntries = (dir: string): Dirent[] => {
    try {
        return readdirSync(dir, { withFileTypes: true }).filter((entry) => !entry.name.startsWith("."));
    } catch {
        return [];
    }
};

const isSchemaFile = (entry: Dirent): boolean => entry.isFile() && entry.name.endsWith(SCHEMA_SUFFIX);

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

export const schemaEnvPath = (rootDir: string): string => join(rootDir, "node_modules", ".gtkx", "env.d.ts");

const parseProjectSchemas = (schemaFiles: string[], dataDirAbs: string): ParsedSchemaFile[] => {
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

export const emitSchemaEnv = (rootDir: string, dataDir: string | null): SchemaEnvResult => {
    const dataDirAbs = dataDir === null ? null : join(rootDir, dataDir);
    const schemaFiles = dataDirAbs === null ? [] : findSchemaFiles(dataDirAbs);
    const parsed = dataDirAbs === null ? [] : parseProjectSchemas(schemaFiles, dataDirAbs);
    const content = renderEnvModule(parsed);
    const path = schemaEnvPath(rootDir);
    const written = writeIfChanged(path, content);
    return { path, schemaFiles, written };
};
