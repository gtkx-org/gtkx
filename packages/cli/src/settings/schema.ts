import { isPathInside, isPathWithin, sortStrings, toPosixPath } from "@gtkx/utils";
import {
    copyFileSync,
    existsSync,
    globSync,
    mkdirSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { SourceImport } from "../internal/source-imports.js";
import { I18N_TYPES_FILENAME, i18nTypesPath } from "../i18n/types.js";
import { discoverProjectImports } from "../internal/import-scan.js";
import { PROJECT_FILE_EXCLUDES, sourcePackageRoots } from "../internal/source-imports.js";
import { createRetainedStagingDir, type RetainedStagingDir } from "../internal/staging-dir.js";
import { isBareRelativeAsset, parseIconSpecifier, parseResourceSpecifier } from "../vite-plugins/asset-specifier.js";
import { compileSchemas } from "./compile.js";
import { createSchemaResolver, type ParsedSchemaFile, parseSchemaFile } from "./parser.js";
import { GTKX_SCHEMA_TYPES_HEADER, renderEnvModule, renderSchemaTypes } from "./render.js";

type SchemaEnvResult = {
    path: string;
    isWritten: boolean;
    schemaFiles: string[];
};

const SCHEMA_SUFFIX = ".gschema.xml";
const SCHEMA_TYPES_SUFFIX = ".gschema.d.xml.ts";
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

    const isProjectSchema =
        isPathInside(projectRoot, path) || sourcePackageRoots(projectRoot).some((dir) => isPathWithin(dir, path));

    return isProjectSchema ? toPosixPath(relative(projectRoot, path)) : null;
};

const isRelativeImport = (source: string): boolean => source.startsWith("./") || source.startsWith("../");

const schemaFileFor = ({ importer, source }: SourceImport): string | null =>
    isRelativeImport(source) && source.endsWith(SCHEMA_SUFFIX) ? resolve(dirname(importer), source) : null;

const findImportedSchemaFiles = (imports: SourceImport[]): string[] => {
    const files = imports.map((entry) => schemaFileFor(entry)).filter((path): path is string => path !== null);

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

const uniqueSchemaFiles = (schemaFiles: string[]): string[] => {
    const owners: Map<string, string> = new Map();
    const canonicalFiles = sortStrings(new Set(schemaFiles.map((path) => canonicalPath(path))));

    for (const filePath of canonicalFiles) {
        const name = basename(filePath);
        const owner = owners.get(name);

        if (owner === undefined) {
            owners.set(name, filePath);
        } else if (!readFileSync(owner).equals(readFileSync(filePath))) {
            throw new Error(
                `${owner} and ${filePath} are both named ${name} but differ. GSettings schemas are installed by ` +
                    "file name, so copies of a schema must be identical. Make them identical, or rename one.",
            );
        }
    }

    return [...owners.values()];
};

const stageAndCompileProjectSchemas = (
    root: string,
    staging: RetainedStagingDir = createRetainedStagingDir("schemas"),
): string | null => {
    const schemaFiles = uniqueSchemaFiles(projectSchemaFiles(root).files);

    if (schemaFiles.length === 0) {
        return null;
    }

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

const schemaTypesPath = (schemaFile: string): string =>
    `${schemaFile.slice(0, -SCHEMA_SUFFIX.length)}${SCHEMA_TYPES_SUFFIX}`;

const schemaFileOf = (typesFile: string): string =>
    `${typesFile.slice(0, -SCHEMA_TYPES_SUFFIX.length)}${SCHEMA_SUFFIX}`;

const findProjectFiles = (root: string, suffix: string): string[] =>
    [root, ...sourcePackageRoots(root)].flatMap((dir) =>
        globSync(`**/*${suffix}`, { cwd: dir, exclude: PROJECT_FILE_EXCLUDES }).map((path) => join(dir, path)),
    );

const typedSchemaFiles = (root: string, imports: SourceImport[]): string[] => {
    const imported = uniqueSchemaFiles(findImportedSchemaFiles(imports).filter((path) => existsSync(path)));

    return sortStrings(
        new Set([...findProjectFiles(root, SCHEMA_SUFFIX).map((path) => canonicalPath(path)), ...imported]),
    );
};

const removeStaleSchemaTypes = (root: string): void => {
    for (const path of findProjectFiles(root, SCHEMA_TYPES_SUFFIX)) {
        if (!existsSync(schemaFileOf(path)) && readFileOrNull(path)?.startsWith(GTKX_SCHEMA_TYPES_HEADER)) {
            rmSync(path, { force: true });
        }
    }
};

const emitSchemaTypes = (root: string, imports: SourceImport[]): string[] => {
    const schemaFiles = typedSchemaFiles(root, imports);
    const parsed = schemaFiles.map((path) => ({ path, file: parseSchemaFile(path, basename(path)) }));
    const resolveSchema = createSchemaResolver(parsed.map(({ file }) => file));
    const declarations = parsed.map(({ path, file }) => ({
        path: schemaTypesPath(path),
        content: renderSchemaTypes(resolveSchema(file)),
    }));

    for (const { path, content } of declarations) {
        didWriteChanges(path, content);
    }

    removeStaleSchemaTypes(root);

    return schemaFiles;
};

/**
 * Writes the project's import declarations: `node_modules/.gtkx/env.d.ts` for asset imports, and a
 * `<name>.gschema.d.xml.ts` beside every GSettings schema of the project, which TypeScript resolves for an import
 * of the schema under `allowArbitraryExtensions`. Declarations of schemas that no longer exist are removed.
 */
const emitSchemaEnv = (rootDir: string): SchemaEnvResult => {
    const path = schemaEnvPath(rootDir);
    const { imports, isComplete } = discoverProjectImports(rootDir);
    const schemaFiles = emitSchemaTypes(rootDir, imports);

    if (!isComplete) {
        return { path, isWritten: false, schemaFiles };
    }

    const assets = findAssetModuleSpecifiers(imports);
    const references = existsSync(i18nTypesPath(rootDir)) ? [`./${I18N_TYPES_FILENAME}`] : [];
    const content = renderEnvModule(assets, { references });
    const isWritten = didWriteChanges(path, content);

    return { path, isWritten, schemaFiles };
};

export {
    SCHEMA_SUFFIX,
    prependSchemaDir,
    stageSchema,
    uniqueSchemaFiles,
    projectRelativeSchemaPath,
    stageAndCompileProjectSchemas,
    emitSchemaEnv,
    readProjectSchema,
    projectSchemaFiles,
};
