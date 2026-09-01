import { isPathInside, sortStrings, toPosixPath, warn } from "@gtkx/utils";
import { createHash } from "node:crypto";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { I18N_TYPES_FILENAME, i18nTypesPath } from "../i18n/types.js";
import { discoverSourceImports, type SourceImport } from "../internal/source-imports.js";
import { removeTempDir } from "../internal/staging-dir.js";
import {
    isBareRelativeAsset,
    parseIconSpecifier,
    parseResourceSpecifier,
} from "../vite-plugins/asset-specifier.js";
import { compileSchemas } from "./compile.js";
import { type ParsedSchemaFile, parseSchemaXml, SchemaParseError } from "./parser.js";
import { renderEnvModule } from "./render.js";

type SchemaEnvResult = {
    path: string;
    isWritten: boolean;
};

const SCHEMA_SUFFIX = ".gschema.xml";
const STAGED_NAME_LENGTH = 16;
const SOURCE_DIR = "src";
const RESOURCE_QUERY = "?resource=";
const ICON_QUERY = "?icon=";

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

const projectRelativeSchemaPath = (root: string, filePath: string): string | null => {
    let projectRoot: string;
    let path: string;

    try {
        projectRoot = realpathSync(root);
        path = realpathSync(filePath);
    } catch {
        return null;
    }

    return isPathInside(projectRoot, path) ? toPosixPath(relative(projectRoot, path)) : null;
};

const getRelativeModuleSpecifier = (filePath: string): string => `*/${basename(filePath)}`;

const sourceDirFor = (root: string): string => {
    const sourceDir = join(root, SOURCE_DIR);

    return existsSync(sourceDir) ? sourceDir : root;
};

const isRelativeImport = (source: string): boolean => source.startsWith("./") || source.startsWith("../");

const schemaFileFor = ({ importer, source }: SourceImport): string | null =>
    isRelativeImport(source) && source.endsWith(SCHEMA_SUFFIX) ? resolve(dirname(importer), source) : null;

const findImportedSchemaFiles = (imports: SourceImport[]): string[] => {
    const files = imports
        .map((entry) => schemaFileFor(entry))
        .filter((path): path is string => path !== null);

    return sortStrings(new Set(files));
};

const blockedAssetSpecifier = (source: string): string | null => {
    if (!isBareRelativeAsset(source)) {
        return null;
    }

    const separator = source.lastIndexOf("/");
    const name = source.slice(separator + 1);

    if (name.includes("*")) {
        throw new Error(
            `Cannot generate an asset declaration for ${JSON.stringify(source)}: filenames cannot contain *`,
        );
    }

    return `*/${name}`;
};

const resourceModuleSpecifier = (source: string): string | null => {
    const parsed = parseResourceSpecifier(source);
    const queryIndex = source.indexOf(RESOURCE_QUERY);

    if (queryIndex === -1 || typeof parsed?.resourcePath !== "string") {
        return null;
    }

    const query = source.slice(queryIndex);

    if (query.includes("*")) {
        throw new Error(
            `Cannot generate an asset declaration for ${JSON.stringify(source)}: resource paths cannot contain *`,
        );
    }

    return `*${query}`;
};

const iconModuleSpecifier = (source: string): string | null => {
    const parsed = parseIconSpecifier(source);
    const queryIndex = source.indexOf(ICON_QUERY);

    if (queryIndex === -1 || typeof parsed?.iconName !== "string") {
        return null;
    }

    const query = source.slice(queryIndex);

    if (query.includes("*")) {
        throw new Error(
            `Cannot generate an asset declaration for ${JSON.stringify(source)}: icon names cannot contain *`,
        );
    }

    return `*${query}`;
};

const findAssetModuleSpecifiers = (
    imports: SourceImport[],
): { blocked: string[]; icons: string[]; resources: string[] } => {
    const collect = (getSpecifier: (source: string) => string | null): string[] =>
        sortStrings(new Set(imports.map((entry) => getSpecifier(entry.source)).filter((value) => value !== null)));

    return {
        blocked: collect(blockedAssetSpecifier),
        icons: collect(iconModuleSpecifier),
        resources: collect(resourceModuleSpecifier),
    };
};

const canonicalPath = (path: string): string => {
    try {
        return realpathSync(path);
    } catch {
        return resolve(path);
    }
};

const assertUniqueSchemaBasenames = (schemaFiles: string[]): void => {
    const owners: Map<string, string> = new Map();
    const canonicalFiles = sortStrings(new Set(schemaFiles.map((path) => canonicalPath(path))));

    for (const filePath of canonicalFiles) {
        const name = basename(filePath);
        const owner = owners.get(name);

        if (owner !== undefined && owner !== filePath) {
            throw new Error(
                `Cannot generate types for both ${owner} and ${filePath}: relative GSettings schema imports are ` +
                `typed by basename, and both files are named ${name}. Rename one of them.`,
            );
        }

        owners.set(name, filePath);
    }
};

const stageAndCompileProjectSchemas = (root: string): string | null => {
    const imports = discoverSourceImports(sourceDirFor(root));
    const schemaFiles = findImportedSchemaFiles(imports);
    assertUniqueSchemaBasenames(schemaFiles);

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

const parseSchemaFileOrWarn = (filePath: string, specifier: string): ParsedSchemaFile | null => {
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

const parseProjectSchemas = (schemaFiles: string[], specifierFor: (filePath: string) => string): ParsedSchemaFile[] => {
    const parsed: ParsedSchemaFile[] = [];

    for (const filePath of schemaFiles) {
        const result = parseSchemaFileOrWarn(filePath, specifierFor(filePath));

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

const emitSchemaEnv = (rootDir: string): SchemaEnvResult => {
    const imports = discoverSourceImports(sourceDirFor(rootDir));
    const importedFiles = findImportedSchemaFiles(imports);
    assertUniqueSchemaBasenames(importedFiles);
    const imported = parseProjectSchemas(importedFiles, getRelativeModuleSpecifier);
    const assets = findAssetModuleSpecifiers(imports);
    const references = existsSync(i18nTypesPath(rootDir)) ? [`./${I18N_TYPES_FILENAME}`] : [];
    const content = renderEnvModule(imported, assets, { references });
    const path = schemaEnvPath(rootDir);
    const isWritten = didWriteChanges(path, content);

    return { path, isWritten };
};

export {
    SCHEMA_SUFFIX,
    prependSchemaDir,
    stageSchema,
    assertUniqueSchemaBasenames,
    projectRelativeSchemaPath,
    stageAndCompileProjectSchemas,
    emitSchemaEnv,
};
