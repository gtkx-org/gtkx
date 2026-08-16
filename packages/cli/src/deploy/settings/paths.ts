import { type Stats, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { DeployConfig, DeployPaths } from "../types.js";
import { resolveDataDir } from "../../internal/data-dir.js";
import { findSchemaFiles } from "../../settings/schema.js";

type PathsRequest = {
    root: string;
    deploy: DeployConfig;
    outDirOverride: string | undefined;
};

type ResolvedIcons = {
    iconsDir: string | null;
    iconFile: string | null;
};

const DEFAULT_OUT_DIR = "build";
const DIST_DIR = "dist";
const ICONS_DIR = "icons";
const LICENSE_CANDIDATES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "COPYING.md"];

const isInside = (parent: string, candidate: string): boolean => {
    const rel = relative(parent, candidate);

    return rel.length > 0 && !rel.startsWith("..") && !isAbsolute(rel);
};

const resolveOutDir = ({ root, deploy, outDirOverride }: PathsRequest): string => {
    const configured = outDirOverride ?? deploy.outDir ?? DEFAULT_OUT_DIR;
    const outDir = resolve(root, configured);

    if (!isInside(root, outDir)) {
        throw new Error(`Cannot use "${configured}" as the deploy output directory: it is outside ${root}`);
    }

    return outDir;
};

const getStats = (path: string): Stats | undefined => {
    try {
        return statSync(path, { throwIfNoEntry: false });
    } catch {
        return undefined;
    }
};

const existingFile = (path: string): string | null => (getStats(path)?.isFile() === true ? path : null);
const existingDir = (path: string): string | null => (getStats(path)?.isDirectory() === true ? path : null);

const resolveLicenseFile = (root: string, configured: string | undefined): string | null => {
    if (configured !== undefined) {
        const path = resolve(root, configured);

        if (existingFile(path) === null) {
            throw new Error(`Cannot read the license file "${configured}": no such file under ${root}`);
        }

        return path;
    }

    return LICENSE_CANDIDATES.map((name) => existingFile(join(root, name))).find((path) => path !== null) ?? null;
};

const configuredIcons = (root: string, configured: string): ResolvedIcons => {
    const path = resolve(root, configured);

    if (!isInside(root, path)) {
        throw new Error(`Cannot use "${configured}" as the icon path: it is outside ${root}`);
    }

    if (existingDir(path) !== null) {
        return { iconsDir: path, iconFile: null };
    }

    if (existingFile(path) === null) {
        throw new Error(`Cannot read the icon path "${configured}": no such file or directory under ${root}`);
    }

    return { iconsDir: null, iconFile: path };
};

const defaultIcons = (root: string, dataDir: string | null): ResolvedIcons => ({
    iconsDir: dataDir === null ? null : existingDir(join(root, dataDir, ICONS_DIR)),
    iconFile: null,
});

const resolveIcons = (root: string, dataDir: string | null, configured: string | undefined): ResolvedIcons =>
    configured === undefined ? defaultIcons(root, dataDir) : configuredIcons(root, configured);

const resolvePaths = (request: PathsRequest): DeployPaths => {
    const { root, deploy } = request;
    const outDir = resolveOutDir(request);
    const dataDir = resolveDataDir(root);
    const { iconsDir, iconFile } = resolveIcons(root, dataDir, deploy.icons);

    return {
        root,
        dist: join(root, DIST_DIR),
        outDir,
        metadata: join(outDir, "metadata"),
        runtime: join(outDir, "runtime"),
        stage: join(outDir, "stage"),
        overlay: join(outDir, "overlay"),
        targets: join(outDir, "targets"),
        output: join(outDir, "out"),
        dataDir,
        iconsDir,
        iconFile,
        licenseFile: resolveLicenseFile(root, deploy.licenseFile),
        schemaFiles: dataDir === null ? [] : findSchemaFiles(join(root, dataDir)),
    };
};

export { isInside, resolvePaths };
