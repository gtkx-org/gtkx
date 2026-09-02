import { isPathInside, isRecord } from "@gtkx/utils";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import {
    BUILD_MANIFEST_FILENAME,
    BUILD_MANIFEST_GENERATOR,
} from "./build-manifest.js";

const DEFAULT_BUILD_OUT_DIR = "dist";

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

    if (lstatSync(manifest, { throwIfNoEntry: false })?.isFile() !== true) {
        return false;
    }

    try {
        const parsed: unknown = JSON.parse(readFileSync(manifest, "utf8"));

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

const resolveBuildOutDir = (root: string, configured?: string): string => {
    const selected = configured ?? DEFAULT_BUILD_OUT_DIR;
    const outDir = resolve(root, selected);

    if (!isPathInside(root, outDir) || hasSymlinkComponent(root, outDir) || !isReusableBuildDirectory(outDir)) {
        throw new Error(
            `Build output must be an empty directory or an earlier GTKX build below the project root ${root}`,
        );
    }

    return outDir;
};

export { resolveBuildOutDir };
