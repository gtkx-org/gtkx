import { chmodSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { compileStore } from "./compile-store.js";

/** Where one generated store is written and how it is reached. */
type StoreOptions = {
    /** Directory the generated package is written to, replaced atomically on each run. */
    storeDir: string;
    /** Path the store is symlinked at, which is the specifier's resolution target under `node_modules`. */
    linkDir: string;
    /** Version stamped on the store's `package.json`, taken from the dependency the store is generated for. */
    version: string;
};

type StoreFile = {
    fileName: string;
    source: string;
};

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
    files: StoreFile[];
    manifest: Manifest;
    rawFiles?: RawFile[];
    requiresEnvReference?: boolean;
};

const STORE_DIR_MODE = 0o755;

const subpathExport = (stem: string): { types: string; default: string } => ({
    types: `./${stem}.d.ts`,
    default: `./${stem}.js`,
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

const writeStore = (params: WriteStoreParams): void => {
    const tmp = createTempStore(params.storeDir);

    try {
        for (const file of params.files) {
            writeSourceFile(tmp, file.fileName, file.source);
        }

        compileStore({
            storeDir: tmp,
            files: params.files,
            packageName: params.manifest.name,
            ...(params.requiresEnvReference !== undefined && { requiresEnvReference: params.requiresEnvReference }),
        });

        writePackageJson(tmp, params.manifest);
        const rawFiles = params.rawFiles ?? [];

        for (const raw of rawFiles) {
            writeFileSync(join(tmp, raw.relativePath), raw.content);
        }

        swapStore(tmp, params.storeDir, params.linkDir);
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
};

const writeSourceFile = (storeDir: string, fileName: string, source: string): void => {
    const filePath = join(storeDir, fileName);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, source);
};

const symlinkRelative = (linkPath: string, realTarget: string): void => {
    mkdirSync(dirname(linkPath), { recursive: true });
    rmSync(linkPath, { recursive: true, force: true });
    symlinkSync(relative(dirname(linkPath), realTarget), linkPath, "dir");
};

const writePackageJson = (storeDir: string, manifest: Manifest): void => {
    writeFileSync(join(storeDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
};

const swapStore = (tmp: string, storeDir: string, visibleLink: string): void => {
    const previous = `${storeDir}.old`;
    rmSync(previous, { recursive: true, force: true });

    if (existsSync(storeDir)) {
        renameSync(storeDir, previous);
    }

    renameSync(tmp, storeDir);
    rmSync(previous, { recursive: true, force: true });
    symlinkRelative(visibleLink, storeDir);
};

const createTempStore = (storeDir: string): string => {
    mkdirSync(dirname(storeDir), { recursive: true });
    const tmp = mkdtempSync(`${storeDir}.tmp-`);
    chmodSync(tmp, STORE_DIR_MODE);

    return tmp;
};

export { subpathExport, buildManifest, writeStore, type StoreOptions, type RawFile };
