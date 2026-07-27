import { sortStrings, warn } from "@gtkx/utils";
import { createHash } from "node:crypto";
import { copyFileSync, type Dirent, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { DATA_IMPORT_PREFIX } from "../internal/data-dir.js";
import { removeTempDir } from "../internal/staging-dir.js";
import { compileSchemas } from "./compile.js";
import { type ParsedSchemaFile, parseSchemaXml, SchemaParseError } from "./parser.js";
import { renderEnvModule } from "./render.js";

type SchemaEnvResult = {
    path: string;
    written: boolean;
};

const SCHEMA_SUFFIX = ".gschema.xml";
const STAGED_NAME_LENGTH = 16;

const prependSchemaDir = (dir: string, existing: string | undefined): string => {
    if (existing === undefined || existing.length === 0) {
        return dir;
    }

    if (existing.split(":").includes(dir)) {
        return existing;
    }

    return `${dir}:${existing}`;
};

const stagedSchemaName = (filePath: string): string =>
    `${createHash("sha1").update(filePath).digest("hex").slice(0, STAGED_NAME_LENGTH)}${SCHEMA_SUFFIX}`;

const stageSchema = (dir: string, filePath: string): void => {
    copyFileSync(filePath, join(dir, stagedSchemaName(filePath)));
};

const toForwardSlashes = (value: string): string => value.replaceAll(/[/\\]/g, "/");

const getModuleSpecifier = (dataDirAbs: string, filePath: string): string =>
    `${DATA_IMPORT_PREFIX}/${toForwardSlashes(relative(dataDirAbs, filePath))}`;

const readVisibleEntries = (dir: string): Dirent[] => {
    try {
        return readdirSync(dir, { withFileTypes: true }).filter((entry) => !entry.name.startsWith("."));
    } catch {
        return [];
    }
};

const isSchemaFile = (entry: Dirent): boolean => entry.isFile() && entry.name.endsWith(SCHEMA_SUFFIX);

const collectSchemaFiles = (dir: string, found: string[]): void => {
    for (const entry of readVisibleEntries(dir)) {
        const full = join(dir, entry.name);

        if (entry.isDirectory()) {
            collectSchemaFiles(full, found);
        } else if (isSchemaFile(entry)) {
            found.push(full);
        }
    }
};

const findSchemaFiles = (dataDir: string): string[] => {
    const found: string[] = [];
    collectSchemaFiles(dataDir, found);

    return sortStrings(found);
};

const stageAndCompileProjectSchemas = (root: string, dataDir: string | null): string | null => {
    if (dataDir === null) {
        return null;
    }

    const schemaFiles = findSchemaFiles(join(root, dataDir));

    if (schemaFiles.length === 0) {
        return null;
    }

    const dir = mkdtempSync(join(tmpdir(), "gtkx-schemas-"));

    for (const filePath of schemaFiles) {
        stageSchema(dir, filePath);
    }

    compileSchemas(dir);

    process.once("exit", () => {
        removeTempDir(dir);
    });

    return dir;
};

const schemaEnvPath = (rootDir: string): string => join(rootDir, "node_modules", ".gtkx", "env.d.ts");

const parseSchemaFileOrWarn = (filePath: string, dataDirAbs: string): ParsedSchemaFile | null => {
    const specifier = getModuleSpecifier(dataDirAbs, filePath);

    try {
        return parseSchemaXml(readFileSync(filePath, "utf8"), specifier);
    } catch (error) {
        if (!(error instanceof SchemaParseError)) {
            throw error;
        }

        warn(`Skipping ${filePath} in schema type generation: ${error.message}`);

        return null;
    }
};

const parseProjectSchemas = (schemaFiles: string[], dataDirAbs: string): ParsedSchemaFile[] => {
    const parsed: ParsedSchemaFile[] = [];

    for (const filePath of schemaFiles) {
        const result = parseSchemaFileOrWarn(filePath, dataDirAbs);

        if (result !== null) {
            parsed.push(result);
        }
    }

    return parsed;
};

const readFileOrNull = (path: string): string | null => {
    try {
        return readFileSync(path, "utf8");
    } catch {
        return null;
    }
};

const didWriteChanges = (path: string, content: string): boolean => {
    if (readFileOrNull(path) === content) {
        return false;
    }

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);

    return true;
};

const emitSchemaEnv = (rootDir: string, dataDir: string | null): SchemaEnvResult => {
    const dataDirAbs = dataDir === null ? null : join(rootDir, dataDir);
    const schemaFiles = dataDirAbs === null ? [] : findSchemaFiles(dataDirAbs);
    const parsed = dataDirAbs === null ? [] : parseProjectSchemas(schemaFiles, dataDirAbs);
    const content = renderEnvModule(parsed);
    const path = schemaEnvPath(rootDir);
    const isWritten = didWriteChanges(path, content);

    return { path, written: isWritten };
};

export {
    SCHEMA_SUFFIX,
    prependSchemaDir,
    stageSchema,
    findSchemaFiles,
    stageAndCompileProjectSchemas,
    schemaEnvPath,
    emitSchemaEnv,
};
