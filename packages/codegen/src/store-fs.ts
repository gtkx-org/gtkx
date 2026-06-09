import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { transpileSource } from "./transpile.js";

/**
 * Filesystem primitives shared by the injected-package assemblers
 * ({@link ../gi-store.js}, {@link ../react-gi-store.js}).
 */

/**
 * Fields every injected-package store assembler needs: where the hidden store
 * lives, the visible alias symlink, and the version stamped onto its manifest.
 */
export type StoreOptions = {
    /** Absolute path to the hidden store directory (e.g. `node_modules/.gtkx/gi`). */
    readonly storeDir: string;
    /** Absolute path to the visible alias symlink (e.g. `node_modules/@gtkx/gi`). */
    readonly linkDir: string;
    /** Version string copied onto the emitted package's `package.json`. */
    readonly version: string;
};

/** A transpilable source destined for the store, addressed by output stem. */
export type StoreFile = {
    /** Output path without extension, relative to the store root. */
    readonly stem: string;
    /** Source filename TypeScript uses for diagnostics. */
    readonly fileName: string;
    /** The TypeScript source to transpile and write. */
    readonly source: string;
};

/** A symlink to create inside the store's own bundled `node_modules`. */
export type StoreSymlink = {
    /** Path segments under the store root the symlink is created at. */
    readonly segments: readonly string[];
    /** Absolute symlink target, or `"self"` for the store root itself. */
    readonly target: string | "self";
};

/**
 * Assembles a store in a fresh temp directory and atomically swaps it into
 * place: writes every file pair, the `package.json`, the bundled
 * `node_modules` symlinks, then promotes the temp tree and re-points the
 * visible alias. An optional {@link WriteStoreParams.validate} runs against the
 * temp root before any file is written, so a failure aborts before the store
 * goes live.
 *
 * @param params - {@link WriteStoreParams}
 */
export const writeStore = (params: WriteStoreParams): void => {
    const tmp = tempStoreFor(params.storeDir);
    params.validate?.(tmp);
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

/** Inputs for {@link writeStore}. */
export type WriteStoreParams = {
    /** Absolute hidden store directory. */
    readonly storeDir: string;
    /** Absolute visible alias symlink. */
    readonly linkDir: string;
    /** The source files to transpile and write. */
    readonly files: readonly StoreFile[];
    /** The `package.json` manifest to serialize. */
    readonly manifest: unknown;
    /** The bundled `node_modules` symlinks to create. */
    readonly symlinks: readonly StoreSymlink[];
    /** Verbatim files (e.g. a fingerprint sentinel) written under the store root. */
    readonly rawFiles?: readonly { readonly relativePath: string; readonly content: string }[];
    /** Optional in-memory validation run on the temp root before files are written. */
    readonly validate?: (tmp: string) => void;
};

/**
 * Transpiles `source` and writes the resulting `.js`/`.d.ts` pair at `stem`
 * (relative to `storeDir`), creating parent directories as needed.
 *
 * @param storeDir - Absolute store root the file is written under
 * @param stem - Output path without extension, relative to `storeDir`
 * @param fileName - Source filename TypeScript uses for diagnostics
 * @param source - The TypeScript source to transpile
 */
export const writeFilePair = (storeDir: string, stem: string, fileName: string, source: string): void => {
    const { js, dts } = transpileSource(fileName, source);
    const jsPath = join(storeDir, `${stem}.js`);
    mkdirSync(dirname(jsPath), { recursive: true });
    writeFileSync(jsPath, js);
    writeFileSync(join(storeDir, `${stem}.d.ts`), dts);
};

/**
 * Creates (or replaces) a relative directory symlink at `linkPath` pointing at
 * `realTarget`. Relative so the link survives the store being moved or cached.
 *
 * @param linkPath - Absolute path of the symlink to create
 * @param realTarget - Absolute path the symlink resolves to
 */
export const symlinkRelative = (linkPath: string, realTarget: string): void => {
    mkdirSync(dirname(linkPath), { recursive: true });
    rmSync(linkPath, { recursive: true, force: true });
    symlinkSync(relative(dirname(linkPath), realTarget), linkPath, "dir");
};

/**
 * Writes a pretty-printed `package.json` into `storeDir`.
 *
 * @param storeDir - Absolute directory to write `package.json` into
 * @param manifest - The manifest object to serialize
 */
export const writePackageJson = (storeDir: string, manifest: unknown): void => {
    writeFileSync(join(storeDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
};

/**
 * Swaps a fully-assembled temp store into place and re-points the visible alias
 * at it.
 *
 * The live store is renamed aside and the temp store renamed in before the old
 * tree is deleted, so the store is unavailable only for the duration of a single
 * rename instead of a full recursive delete. Not safe against a second codegen
 * run swapping the same store concurrently.
 *
 * @param tmp - Absolute temp store directory to promote
 * @param storeDir - Absolute final store directory
 * @param visibleLink - Absolute path of the visible alias symlink
 */
export const swapStore = (tmp: string, storeDir: string, visibleLink: string): void => {
    const previous = `${storeDir}.old`;
    rmSync(previous, { recursive: true, force: true });
    if (existsSync(storeDir)) {
        renameSync(storeDir, previous);
    }
    renameSync(tmp, storeDir);
    rmSync(previous, { recursive: true, force: true });
    symlinkRelative(visibleLink, storeDir);
};

/**
 * Creates a fresh, per-run temporary store directory next to `storeDir` and
 * returns its path. The random suffix isolates concurrent or repeated runs so
 * they cannot corrupt each other's in-progress trees.
 */
export const tempStoreFor = (storeDir: string): string => {
    mkdirSync(dirname(storeDir), { recursive: true });
    return mkdtempSync(`${storeDir}.tmp-`);
};
