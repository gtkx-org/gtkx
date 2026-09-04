import { isPathInside, isRecord } from "@gtkx/utils";
import { lstatSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
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

const outputName = (root: string, path: string): string => relative(root, path) || ".";

const gtkxBuildAncestor = (root: string, outDir: string): string | null => {
    let ancestor = dirname(outDir);

    while (isPathInside(root, ancestor)) {
        if (isGtkxBuildDirectory(ancestor)) {
            return ancestor;
        }

        ancestor = dirname(ancestor);
    }

    return null;
};

const childDirectories = (parent: string): string[] =>
    readdirSync(parent, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(parent, entry.name));

const gtkxBuildDescendant = (root: string): string | null => {
    const pending = childDirectories(root);

    while (pending.length > 0) {
        const path = pending.pop();

        if (path === undefined) {
            return null;
        }

        if (isGtkxBuildDirectory(path)) {
            return path;
        }

        pending.push(...childDirectories(path));
    }

    return null;
};

const assertSafeBuildLocation = (root: string, outDir: string): void => {
    if (!isPathInside(root, outDir)) {
        throw new Error(`Build output ${outDir} must be below the project root ${root}`);
    }

    if (hasSymlinkComponent(root, outDir)) {
        throw new Error(`Build output ${outputName(root, outDir)} passes through a symbolic link`);
    }

    const ancestor = gtkxBuildAncestor(root, outDir);

    if (ancestor !== null) {
        throw new Error(
            `Build output ${outputName(root, outDir)} is nested inside the earlier GTKX build ` +
            outputName(root, ancestor),
        );
    }
};

const nonReusableBuildOutputError = (root: string, outDir: string): Error => {
    const stats = lstatSync(outDir, { throwIfNoEntry: false });

    if (stats?.isDirectory() !== true) {
        return new Error(`Build output ${outputName(root, outDir)} exists and is not a directory`);
    }

    const descendant = gtkxBuildDescendant(outDir);

    if (descendant !== null) {
        return new Error(
            `Build output ${outputName(root, outDir)} contains the earlier GTKX build ` +
            outputName(root, descendant),
        );
    }

    return new Error(
        `Build output ${outputName(root, outDir)} is nonempty and is not an earlier GTKX build`,
    );
};

const resolveBuildOutDir = (root: string, configured?: string): string => {
    const selected = configured ?? DEFAULT_BUILD_OUT_DIR;
    const outDir = resolve(root, selected);

    assertSafeBuildLocation(root, outDir);

    if (!isReusableBuildDirectory(outDir)) {
        throw nonReusableBuildOutputError(root, outDir);
    }

    return outDir;
};

const prepareBuildOutDir = (root: string, outDir: string): PreparedBuildOutDir => {
    assertSafeBuildLocation(root, outDir);
    const prepared = prepareOutputDirectory(root, outDir, isReusableBuildDirectory);

    if (prepared.status === "unsafe") {
        throw new Error(`Build output ${outputName(root, outDir)} became unsafe while preparing it`);
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
