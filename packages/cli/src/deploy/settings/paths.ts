import { lstatSync, type Stats } from "node:fs";
import { join, resolve } from "node:path";
import type { DeployConfig, DeployPaths } from "../types.js";
import { resolveDataDir } from "../../internal/data-dir.js";
import { inspectProjectPath } from "../../internal/project-path.js";
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

const getStats = (path: string): Stats | undefined => lstatSync(path, { throwIfNoEntry: false });

const resolveOutDir = ({ root, deploy, outDirOverride }: PathsRequest): string => {
    const configured = outDirOverride ?? deploy.outDir ?? DEFAULT_OUT_DIR;
    const outDir = resolve(root, configured);
    const stats = inspectProjectPath({ root, candidate: outDir, configured, subject: "deploy output directory" });

    if (stats !== undefined && !stats.isDirectory()) {
        throw new Error(`Cannot use "${configured}" as the deploy output directory below ${root}`);
    }

    return outDir;
};

const existingFile = (path: string): string | null => (getStats(path)?.isFile() === true ? path : null);
const existingDir = (path: string): string | null => (getStats(path)?.isDirectory() === true ? path : null);

const assertContainedPath = (root: string, configured: string, path: string, kind: string): void => {
    inspectProjectPath({ root, candidate: path, configured, subject: kind });
};

const ownedDirectory = (root: string, path: string, subject: string): string => {
    const stats = inspectProjectPath({ root, candidate: path, configured: path, subject });

    if (stats !== undefined && !stats.isDirectory()) {
        throw new Error(`Cannot use ${path} as the ${subject}`);
    }

    return path;
};

const resolveLicenseFile = (root: string, configured: string | undefined): string | null => {
    if (configured !== undefined) {
        const path = resolve(root, configured);
        assertContainedPath(root, configured, path, "license file");

        if (existingFile(path) === null) {
            throw new Error(`Cannot read the license file "${configured}": no such file under ${root}`);
        }

        return path;
    }

    return LICENSE_CANDIDATES.map((name) => existingFile(join(root, name))).find((path) => path !== null) ?? null;
};

const configuredIcons = (root: string, configured: string): ResolvedIcons => {
    const path = resolve(root, configured);
    assertContainedPath(root, configured, path, "icon path");

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
    const dist = ownedDirectory(root, join(root, DIST_DIR), "build output directory");
    const metadata = ownedDirectory(root, join(outDir, "metadata"), "deploy metadata directory");
    const runtime = ownedDirectory(root, join(outDir, "runtime"), "deploy runtime directory");
    const stage = ownedDirectory(root, join(outDir, "stage"), "deploy staging directory");
    const overlay = ownedDirectory(root, join(outDir, "overlay"), "deploy overlay directory");
    const targets = ownedDirectory(root, join(outDir, "targets"), "deploy manifest directory");
    const output = ownedDirectory(root, join(outDir, "out"), "deploy artifact directory");
    const dataDir = resolveDataDir(root);
    const { iconsDir, iconFile } = resolveIcons(root, dataDir, deploy.icons);

    return {
        root,
        dist,
        outDir,
        metadata,
        runtime,
        stage,
        overlay,
        targets,
        output,
        dataDir,
        iconsDir,
        iconFile,
        licenseFile: resolveLicenseFile(root, deploy.licenseFile),
        schemaFiles: dataDir === null ? [] : findSchemaFiles(join(root, dataDir)),
    };
};

export { resolvePaths };
