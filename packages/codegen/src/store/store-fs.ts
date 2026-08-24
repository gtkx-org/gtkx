import { errorMessage } from "@gtkx/utils";
import {
    chmodSync,
    existsSync,
    lstatSync,
    mkdirSync,
    realpathSync,
    renameSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { keepFailedProject, type SourceModule } from "../compile.js";
import { createStagingDir } from "../staging.js";
import { compileStore } from "./compile-store.js";
import { ensureExternalPackageLinks, resetExternalPackageLinks } from "./external-package-links.js";

/** Where one generated store is written and how it is reached. */
type StoreOptions = {
    /** Directory the generated package is written to, replaced atomically on each run. */
    storeDir: string;
    /** Path the store is symlinked at, which is the specifier's resolution target under `node_modules`. */
    linkDir: string;
    /** Version stamped on the store's `package.json`, taken from the dependency the store is generated for. */
    version: string;
};

type StoreLink = Pick<StoreOptions, "storeDir" | "linkDir">;

type Manifest = {
    name: string;
    type: "module";
    version: string;
    sideEffects: true;
    exports: Record<string, unknown>;
    peerDependencies?: Record<string, string>;
};

type ManifestInput = {
    name: string;
    version: string;
    exports: Record<string, unknown>;
    peerDependencies?: Record<string, string>;
};

type RawFile = { relativePath: string; content: string };

type WriteStoreParams = {
    storeDir: string;
    linkDir: string;
    files: SourceModule[];
    manifest: Manifest;
    rawFiles?: RawFile[];
};

const STORE_DIR_MODE = 0o755;
const FAILED_STORE_SUFFIX = ".failed";

const subpathExport = (stem: string): { types: string; default: string } => ({
    types: `./${stem}.d.ts`,
    default: `./${stem}.js`,
});

const namespaceBarrel = (directory: string): { fileName: string; source: string } => ({
    fileName: `${directory}/index.ts`,
    source: `export * from "./${directory}.js";\n`,
});

const buildManifest = (input: ManifestInput): Manifest => {
    const manifest: Manifest = {
        name: input.name,
        type: "module",
        version: input.version,
        sideEffects: true,
        exports: { "./package.json": "./package.json", ...input.exports },
    };

    if (input.peerDependencies) {
        manifest.peerDependencies = input.peerDependencies;
    }

    return manifest;
};

const assertRegularParent = (path: string): void => {
    const parent = dirname(path);
    const stats = lstatSync(parent, { throwIfNoEntry: false });

    if (stats !== undefined && !stats.isDirectory()) {
        throw new Error(`Cannot write a generated-store entry through ${parent}`);
    }
};

const writeStore = (params: WriteStoreParams): void => {
    assertRegularParent(params.storeDir);
    assertRegularParent(params.linkDir);
    const tmp = createTempStore(params.storeDir);
    const keepAt = `${params.storeDir}${FAILED_STORE_SUFFIX}`;

    try {
        buildTempStore(tmp, params);
        swapStore(tmp, params.storeDir);
        resetExternalPackageLinks(params.storeDir);
        ensureStoreLink(params);
    } catch (error) {
        throw keepFailedProject({ projectDir: tmp, keepAt, error });
    }

    rmSync(keepAt, { recursive: true, force: true });
};

const buildTempStore = (tmp: string, params: WriteStoreParams): void => {
    writePackageJson(tmp, params.manifest);

    for (const file of params.files) {
        writeSourceFile(tmp, file.fileName, file.source);
    }

    compileStore({ storeDir: tmp, files: params.files, packageName: params.manifest.name });
    const rawFiles = params.rawFiles ?? [];

    for (const raw of rawFiles) {
        writeFileSync(storeFilePath(tmp, raw.relativePath), raw.content);
    }
};

const storeFilePath = (storeDir: string, fileName: string): string => {
    const filePath = resolve(storeDir, fileName);
    const rel = relative(storeDir, filePath);
    const isEntry = rel.length > 0 && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);

    if (!isEntry) {
        throw new Error(`Cannot write generated store entry "${fileName}" outside ${storeDir}`);
    }

    return filePath;
};

const writeSourceFile = (storeDir: string, fileName: string, source: string): void => {
    const filePath = storeFilePath(storeDir, fileName);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, source);
};

const symlinkRelative = (linkPath: string, realTarget: string): void => {
    assertRegularParent(linkPath);
    mkdirSync(dirname(linkPath), { recursive: true });
    assertRegularParent(linkPath);
    rmSync(linkPath, { recursive: true, force: true });
    symlinkSync(relative(dirname(linkPath), realTarget), linkPath, "dir");
};

const writePackageJson = (storeDir: string, manifest: Manifest): void => {
    writeFileSync(join(storeDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
};

const swapStore = (tmp: string, storeDir: string): void => {
    const previous = `${storeDir}.old`;
    rmSync(previous, { recursive: true, force: true });

    if (existsSync(storeDir)) {
        renameSync(storeDir, previous);
    }

    renameSync(tmp, storeDir);
    rmSync(previous, { recursive: true, force: true });
};

const isStoreLinked = (link: StoreLink): boolean => {
    try {
        return realpathSync(link.linkDir) === realpathSync(link.storeDir);
    } catch {
        return false;
    }
};

const ensureStoreLink = (link: StoreLink): void => {
    if (!existsSync(join(link.storeDir, "package.json"))) {
        return;
    }

    if (!isStoreLinked(link)) {
        symlinkRelative(link.linkDir, link.storeDir);
    }

    ensureExternalPackageLinks(link);
};

const storeWriteMessage = (storeDir: string, error: unknown): string =>
    `Cannot write the generated store to ${storeDir}: ${errorMessage(error)}. ` +
    "Codegen writes the store into the node_modules the @gtkx packages resolve from, " +
    `so ${dirname(storeDir)} has to be writable.`;

const createTempStore = (storeDir: string): string => {
    try {
        const tmp = createStagingDir(storeDir);
        chmodSync(tmp, STORE_DIR_MODE);

        return tmp;
    } catch (error) {
        throw new Error(storeWriteMessage(storeDir, error), { cause: error });
    }
};

export {
    subpathExport,
    buildManifest,
    ensureStoreLink,
    namespaceBarrel,
    symlinkRelative,
    writeStore,
    type StoreLink,
    type StoreOptions,
    type RawFile,
};
