import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { transpileSource } from "./transpile.js";

/**
 * Filesystem primitives shared by the injected-package assemblers
 * ({@link ../gi-store.js}, {@link ../jsx-store.js}).
 */

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
 * rename rather than a full recursive delete. Not safe against a second codegen
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
