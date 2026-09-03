import { isPathInside, isRecord } from "@gtkx/utils";
import { lstatSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import {
    BUILD_MANIFEST_FILENAME,
    BUILD_MANIFEST_GENERATOR,
} from "./build-manifest.js";
import {
    type OutputDirectoryTransaction,
    prepareOutputDirectory,
    readRegularFile,
} from "./output-directory.js";

const DEFAULT_BUILD_OUT_DIR = "dist";
const PRESERVED_BUILD_ENTRIES: ReadonlySet<string> = new Set([".git"]);

type PreparedBuildOutDir = Disposable & { commit: () => void; path: string };

const hasSymlinkComponent = (root: string, target: string): boolean => {
    let current = root;

    for (const segment of relative(root, target).split(sep)) {
        current = join(current, segment);

        if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink() === true) {
            return true;
        }
    }

    return false;
};

const isGtkxBuildDirectory = (path: string): boolean => {
    const manifest = join(path, BUILD_MANIFEST_FILENAME);
    const contents = readRegularFile(manifest);

    try {
        const parsed: unknown = contents === null ? null : JSON.parse(contents);

        return isRecord(parsed) && parsed.generator === BUILD_MANIFEST_GENERATOR;
    } catch {
        return false;
    }
};

const isReusableBuildDirectory = (path: string): boolean => {
    const stats = lstatSync(path, { throwIfNoEntry: false });

    if (stats === undefined) {
        return true;
    }

    return stats.isDirectory() && (readdirSync(path).length === 0 || isGtkxBuildDirectory(path));
};

const buildOutputError = (root: string): Error =>
    new Error(`Build output must be an empty directory or an earlier GTKX build below the project root ${root}`);

const assertSafeBuildLocation = (root: string, outDir: string): void => {
    if (!isPathInside(root, outDir) || hasSymlinkComponent(root, outDir)) {
        throw buildOutputError(root);
    }
};

const resolveBuildOutDir = (root: string, configured?: string): string => {
    const selected = configured ?? DEFAULT_BUILD_OUT_DIR;
    const outDir = resolve(root, selected);

    assertSafeBuildLocation(root, outDir);

    if (!isReusableBuildDirectory(outDir)) {
        throw buildOutputError(root);
    }

    return outDir;
};

const prepareBuildOutDir = (root: string, outDir: string): PreparedBuildOutDir => {
    assertSafeBuildLocation(root, outDir);
    const prepared = prepareOutputDirectory(root, outDir, isReusableBuildDirectory);

    if (prepared.status === "unsafe") {
        throw buildOutputError(root);
    }

    const transaction: OutputDirectoryTransaction = prepared.transaction;

    return {
        path: transaction.path,
        commit: () => {
            transaction.commit(PRESERVED_BUILD_ENTRIES, isGtkxBuildDirectory);
        },
        [Symbol.dispose]: () => {
            transaction[Symbol.dispose]();
        },
    };
};

export { prepareBuildOutDir, resolveBuildOutDir };
