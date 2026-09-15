import { isPathInside, sortStrings, toPosixPath } from "@gtkx/utils";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    realpathSync,
    writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { SourceImport } from "../internal/source-imports.js";
import { I18N_TYPES_FILENAME, i18nTypesPath } from "../i18n/types.js";
import { discoverProjectImports } from "../internal/import-scan.js";
import { createRetainedStagingDir } from "../internal/staging-dir.js";
import {
    isBareRelativeAsset,
    parseIconSpecifier,
    parseResourceSpecifier,
} from "../vite-plugins/asset-specifier.js";
import { compileSchemas } from "./compile.js";
import { createSchemaResolver, type ParsedSchemaFile, parseSchemaFile } from "./parser.js";
import { renderEnvModule } from "./render.js";

type SchemaEnvResult = {
    path: string;
    isWritten: boolean;
};

const SCHEMA_SUFFIX = ".gschema.xml";
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

const stageSchema = (dir: string, filePath: string): void => {
    copyFileSync(filePath, join(dir, basename(filePath)));
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

const isRelativeImport = (source: string): boolean => source.startsWith("./") || source.startsWith("../");

const schemaFileFor = ({ importer, source }: SourceImport): string | null =>
    isRelativeImport(source) && source.endsWith(SCHEMA_SUFFIX) ? resolve(dirname(importer), source) : null;

const findImportedSchemaFiles = (imports: SourceImport[]): string[] => {
    const files = imports
        .map((entry) => schemaFileFor(entry))
        .filter((path): path is string => path !== null);

    return sortStrings(new Set(files));
};

const projectSchemaFiles = (root: string): { files: string[]; isComplete: boolean } => {
    const { imports, isComplete } = discoverProjectImports(root);

    return { files: findImportedSchemaFiles(imports), isComplete };
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
    const { files: schemaFiles } = projectSchemaFiles(root);
    assertUniqueSchemaBasenames(schemaFiles);

    if (schemaFiles.length === 0) {
        return null;
    }

    const staging = createRetainedStagingDir("schemas");
    const dir = staging.retain();

    try {
        for (const filePath of schemaFiles) {
            stageSchema(dir, filePath);
        }

        compileSchemas(dir);

        return dir;
    } catch (error) {
        staging.release();
        throw error;
    }
};

const schemaEnvPath = (rootDir: string): string => join(rootDir, "node_modules", ".gtkx", "env.d.ts");

const parseProjectSchemas = (schemaFiles: string[], specifierFor: (filePath: string) => string): ParsedSchemaFile[] => {
    const files = schemaFiles.map((path) => parseSchemaFile(path, specifierFor(path)));
    const resolveSchema = createSchemaResolver(files);

    return files.map((file) => resolveSchema(file));
};

const readProjectSchema = (root: string, filePath: string): ParsedSchemaFile => {
    const file = parseSchemaFile(filePath, basename(filePath));
    const { files: paths } = projectSchemaFiles(root);
    const dependencies = paths.filter((path) => path !== filePath).map((path) => parseSchemaFile(path, basename(path)));
    const resolveSchema = createSchemaResolver([file, ...dependencies]);

    return resolveSchema(file);
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
    const { imports } = discoverProjectImports(rootDir);
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
    readProjectSchema,
    projectSchemaFiles,
};
