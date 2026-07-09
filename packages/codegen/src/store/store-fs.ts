import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { compileStore } from "./compile-store.js";

export type StoreOptions = {
    storeDir: string;
    linkDir: string;
    version: string;
};

type StoreFile = {
    fileName: string;
    source: string;
};

export const subpathExport = (stem: string): { types: string; default: string } => ({
    types: `./${stem}.d.ts`,
    default: `./${stem}.js`,
});

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

export const buildManifest = (input: ManifestInput): Manifest => {
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

export const writeStore = (params: WriteStoreParams): void => {
    const tmp = tempStoreFor(params.storeDir);
    for (const file of params.files) {
        writeSourceFile(tmp, file.fileName, file.source);
    }
    compileStore({
        storeDir: tmp,
        files: params.files,
        packageName: params.manifest.name,
        exports: params.manifest.exports,
    });
    writePackageJson(tmp, params.manifest);
    for (const raw of params.rawFiles ?? []) {
        writeFileSync(join(tmp, raw.relativePath), raw.content);
    }
    symlinkRelative(join(tmp, "node_modules", ...params.manifest.name.split("/")), tmp);
    swapStore(tmp, params.storeDir, params.linkDir);
};

type WriteStoreParams = {
    storeDir: string;
    linkDir: string;
    files: StoreFile[];
    manifest: Manifest;
    rawFiles?: { relativePath: string; content: string }[];
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

const tempStoreFor = (storeDir: string): string => {
    mkdirSync(dirname(storeDir), { recursive: true });
    return mkdtempSync(`${storeDir}.tmp-`);
};
