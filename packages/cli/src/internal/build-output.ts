import { isPathInside, isRecord } from "@gtkx/utils";
import { lstatSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
    BUILD_MANIFEST_FILENAME,
    BUILD_MANIFEST_GENERATOR,
} from "./build-manifest.js";
import { hasSymlinkComponent, prepareOutputDirectory, readRegularFile } from "./output-directory.js";

const DEFAULT_BUILD_OUT_DIR = "dist";
const PRESERVED_BUILD_ENTRIES = [".git"];

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

const prepareBuildOutDir = (root: string, outDir: string) => {
    return prepareOutputDirectory(root, outDir, {
        preservedEntries: PRESERVED_BUILD_ENTRIES,
    });
};

export { prepareBuildOutDir, resolveBuildOutDir };
