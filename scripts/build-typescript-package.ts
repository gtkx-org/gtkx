import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
    cpSync,
    existsSync,
    lstatSync,
    readdirSync,
    readFileSync,
    realpathSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const workspaceRoot = realpathSync(resolve(import.meta.dirname, ".."));
const projectArgument = process.argv[2];

if (projectArgument === undefined) {
    throw new TypeError("Expected a project root");
}

const projectCandidate = resolve(workspaceRoot, projectArgument);
const relativeRoot = relative(workspaceRoot, projectCandidate);

if (
    relativeRoot === "" ||
    relativeRoot === ".." ||
    relativeRoot.startsWith(`..${sep}`) ||
    isAbsolute(relativeRoot)
) {
    throw new TypeError(`Invalid TypeScript project root: ${projectArgument}`);
}

let currentProjectPath = workspaceRoot;

for (const segment of relativeRoot.split(sep)) {
    currentProjectPath = join(currentProjectPath, segment);
    const stats = lstatSync(currentProjectPath, { throwIfNoEntry: false });

    if (stats?.isDirectory() !== true) {
        throw new TypeError(`Invalid TypeScript project root: ${projectArgument}`);
    }
}

const projectRoot = realpathSync(projectCandidate);
const realRelativeRoot = relative(workspaceRoot, projectRoot);

if (
    realRelativeRoot === "" ||
    realRelativeRoot === ".." ||
    realRelativeRoot.startsWith(`..${sep}`) ||
    isAbsolute(realRelativeRoot)
) {
    throw new TypeError(`Invalid TypeScript project root: ${projectArgument}`);
}

const configPath = join(projectRoot, "tsconfig.lib.json");

if (lstatSync(configPath, { throwIfNoEntry: false })?.isFile() !== true) {
    throw new TypeError(`Invalid TypeScript project root: ${projectArgument}`);
}

const buildId = randomUUID();
const distPath = join(projectRoot, "dist");
const stagedDistPath = join(projectRoot, `.dist-${buildId}`);
const backupDistPath = join(projectRoot, `.dist-backup-${buildId}`);
const buildInfoPath = join(projectRoot, "tsconfig.lib.tsbuildinfo");
const stagedBuildInfoPath = join(projectRoot, `.tsconfig.lib-${buildId}.tsbuildinfo`);
let wasPreviousOutputMoved = false;
let isOutputInstalled = false;

const portableRelativePath = (path: string): string => relative(projectRoot, path).split(sep).join("/");

const replaceLiteral = (value: string, search: string, replacement: string): string =>
    value.split(search).join(replacement);

const takeLast = (paths: string[]): string => {
    const path = paths.pop();

    if (path === undefined) {
        throw new Error("Cannot take a path from an empty list");
    }

    return path;
};

const buildAssetChildren = (path: string): string[] => {
    const stats = lstatSync(path);

    if (stats.isFile()) {
        return [];
    }

    if (!stats.isDirectory()) {
        throw new TypeError(`Build assets must be regular files or directories: ${path}`);
    }

    return readdirSync(path).map((entry) => join(path, entry));
};

const assertBuildAssetTree = (root: string): void => {
    const pending = [root];

    while (pending.length > 0) {
        pending.push(...buildAssetChildren(takeLast(pending)));
    }
};

const assertBuildAssetPath = (path: string): void => {
    const segments = relative(projectRoot, path).split(sep);
    let current = projectRoot;

    for (const [index, segment] of segments.entries()) {
        current = join(current, segment);
        const stats = lstatSync(current, { throwIfNoEntry: false });
        const isFinal = index === segments.length - 1;

        if (
            stats === undefined ||
            stats.isSymbolicLink() ||
            (!isFinal && !stats.isDirectory())
        ) {
            throw new TypeError(`Invalid build asset: ${path}`);
        }
    }

    assertBuildAssetTree(path);
};

const normalizeBuildInfoPaths = (): void => {
    const stagedDist = portableRelativePath(stagedDistPath);
    const stagedBuildInfo = portableRelativePath(stagedBuildInfoPath);
    const dist = portableRelativePath(distPath);
    const buildInfo = portableRelativePath(buildInfoPath);

    const content = replaceLiteral(
        replaceLiteral(readFileSync(stagedBuildInfoPath, "utf8"), stagedDist, dist),
        stagedBuildInfo,
        buildInfo,
    );

    writeFileSync(stagedBuildInfoPath, content);
};

try {
    execFileSync(
        process.platform === "win32" ? "tsc.cmd" : "tsc",
        ["--project", configPath, "--outDir", stagedDistPath, "--tsBuildInfoFile", stagedBuildInfoPath],
        { cwd: projectRoot, stdio: "inherit" },
    );

    for (const assetArgument of process.argv.slice(3)) {
        const assetPath = resolve(projectRoot, assetArgument);
        const sourceRoot = join(projectRoot, "src");
        const relativeAsset = relative(sourceRoot, assetPath);

        if (
            relativeAsset === "" ||
            relativeAsset === ".." ||
            relativeAsset.startsWith(`..${sep}`) ||
            isAbsolute(relativeAsset) ||
            !existsSync(assetPath)
        ) {
            throw new TypeError(`Invalid build asset: ${assetArgument}`);
        }

        assertBuildAssetPath(assetPath);
        cpSync(assetPath, join(stagedDistPath, relativeAsset), { recursive: true });
    }

    if (!existsSync(stagedBuildInfoPath)) {
        throw new Error(`TypeScript did not write build information for ${projectArgument}`);
    }

    normalizeBuildInfoPaths();

    if (existsSync(distPath)) {
        renameSync(distPath, backupDistPath);
        wasPreviousOutputMoved = true;
    }

    try {
        renameSync(stagedDistPath, distPath);
        isOutputInstalled = true;
        renameSync(stagedBuildInfoPath, buildInfoPath);
    } catch (error) {
        if (isOutputInstalled) {
            rmSync(distPath, { recursive: true, force: true });
            isOutputInstalled = false;
        }

        if (wasPreviousOutputMoved) {
            renameSync(backupDistPath, distPath);
            wasPreviousOutputMoved = false;
        }

        throw error;
    }

    rmSync(backupDistPath, { recursive: true, force: true });
    wasPreviousOutputMoved = false;
} finally {
    rmSync(stagedDistPath, { recursive: true, force: true });
    rmSync(stagedBuildInfoPath, { force: true });

    if (wasPreviousOutputMoved && !existsSync(distPath)) {
        renameSync(backupDistPath, distPath);
    }
}
