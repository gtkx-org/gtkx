import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { transpileSource } from "./transpile.js";

export type StoreOptions = {
    storeDir: string;
    linkDir: string;
    version: string;
};

type StoreFile = {
    stem: string;
    fileName: string;
    source: string;
};

type StoreSymlink = {
    segments: string[];
    target: string | "self";
};

export const subpathExport = (stem: string): { types: string; default: string } => ({
    types: `./${stem}.d.ts`,
    default: `./${stem}.js`,
});

/**
 * A generated store's `package.json` manifest.
 *
 * Carries the fixed `type: "module"` and `sideEffects: true` defaults shared by
 * every gtkx store, plus the per-store name, version, and subpath export map.
 */
export type Manifest = {
    name: string;
    type: "module";
    version: string;
    sideEffects: true;
    exports: Record<string, unknown>;
};

/**
 * Inputs to {@link buildManifest}.
 */
export type ManifestInput = {
    name: string;
    version: string;
    exports: Record<string, unknown>;
};

/**
 * Builds a store {@link Manifest}, injecting the `"./package.json"` self-export
 * and the shared `type`/`sideEffects` defaults around the caller's exports.
 *
 * @param input - The store name, version, and per-store subpath exports.
 * @returns The assembled manifest.
 */
export const buildManifest = (input: ManifestInput): Manifest => ({
    name: input.name,
    type: "module",
    version: input.version,
    sideEffects: true,
    exports: { "./package.json": "./package.json", ...input.exports },
});

/**
 * Builds a self-targeting symlink entry under the given path segments.
 *
 * The store resolves the `"self"` target to its own root, so this expresses the
 * convention of linking a store into its own `node_modules` tree.
 *
 * @param segments - Path segments, relative to the store root, for the link.
 * @returns The self-targeting symlink descriptor.
 */
export const selfLink = (...segments: string[]): StoreSymlink => ({ segments, target: "self" });

export const writeStore = (params: WriteStoreParams): void => {
    const tmp = tempStoreFor(params.storeDir);
    for (const file of params.files) {
        writeFilePair(tmp, file.stem, file.fileName, file.source);
    }
    writePackageJson(tmp, params.manifest);
    for (const raw of params.rawFiles ?? []) {
        writeFileSync(join(tmp, raw.relativePath), raw.content);
    }
    for (const { segments, target } of params.symlinks) {
        symlinkRelative(join(tmp, ...segments), target === "self" ? tmp : target);
    }
    swapStore(tmp, params.storeDir, params.linkDir);
};

export type WriteStoreParams = {
    storeDir: string;
    linkDir: string;
    files: StoreFile[];
    manifest: Manifest;
    symlinks: StoreSymlink[];
    rawFiles?: { relativePath: string; content: string }[];
};

const writeFilePair = (storeDir: string, stem: string, fileName: string, source: string): void => {
    const { js, dts } = transpileSource(fileName, source);
    const jsPath = join(storeDir, `${stem}.js`);
    mkdirSync(dirname(jsPath), { recursive: true });
    writeFileSync(jsPath, js);
    writeFileSync(join(storeDir, `${stem}.d.ts`), dts);
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
