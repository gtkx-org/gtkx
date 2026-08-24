import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { publishPackage } from "./pnpm-publish.js";
import { distTagForVersion, type PackageManifest, stripDevArtifacts } from "./publish-manifest.js";

type FileSnapshot = {
    contents: string;
    mode: number;
};

type StagedFile = {
    path: string;
    original: FileSnapshot | undefined;
};

const FILE_MODE_MASK = 0o7777;

const findRepoRoot = (start: string): string => {
    let dir = start;

    while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
        const parent = dirname(dir);

        if (parent === dir) {
            throw new Error("Could not locate the monorepo root (pnpm-workspace.yaml)");
        }

        dir = parent;
    }

    return dir;
};

const readRegularFile = (path: string): FileSnapshot => {
    const stats = lstatSync(path);

    if (!stats.isFile()) {
        throw new TypeError(`Release input is not a regular file: ${path}`);
    }

    return { contents: readFileSync(path, "utf8"), mode: stats.mode & FILE_MODE_MASK };
};

const readOptionalRegularFile = (path: string): FileSnapshot | undefined => {
    const stats = lstatSync(path, { throwIfNoEntry: false });

    if (stats === undefined) {
        return undefined;
    }

    return readRegularFile(path);
};

const replaceFile = (path: string, file: FileSnapshot): void => {
    const temporary = join(dirname(path), `.gtkx-release-${basename(path)}-${randomUUID()}`);

    try {
        writeFileSync(temporary, file.contents, { flag: "wx", mode: file.mode });
        renameSync(temporary, path);
    } finally {
        rmSync(temporary, { force: true });
    }
};

const restoreStagedFile = ({ path, original }: StagedFile): void => {
    if (original === undefined) {
        rmSync(path, { force: true });
    } else {
        replaceFile(path, original);
    }
};

const restoreStagedFiles = (files: StagedFile[]): void => {
    const errors: unknown[] = [];

    for (const file of files) {
        try {
            restoreStagedFile(file);
        } catch (error) {
            errors.push(error);
        }
    }

    if (errors.length > 0) {
        throw new AggregateError(errors, "Failed to restore release files");
    }
};

const releasePackage = (): void => {
    const packageDir = process.cwd();
    const root = findRepoRoot(packageDir);
    const manifestPath = join(packageDir, "package.json");
    const originalManifest = readRegularFile(manifestPath);
    const manifest = JSON.parse(originalManifest.contents) as PackageManifest;
    const tag = distTagForVersion(manifest.version ?? "");
    const readmePath = join(packageDir, "README.md");
    const licensePath = join(packageDir, "LICENSE");
    const originalReadme = readOptionalRegularFile(readmePath);
    const originalLicense = readOptionalRegularFile(licensePath);
    const rootReadme = readRegularFile(join(root, "README.md"));
    const rootLicense = readRegularFile(join(root, "LICENSE"));

    const stagedFiles: StagedFile[] = [
        { path: manifestPath, original: originalManifest },
        { path: readmePath, original: originalReadme },
        { path: licensePath, original: originalLicense },
    ];

    try {
        replaceFile(readmePath, rootReadme);
        replaceFile(licensePath, rootLicense);

        replaceFile(manifestPath, {
            contents: `${JSON.stringify(stripDevArtifacts(manifest), null, 4)}\n`,
            mode: originalManifest.mode,
        });

        publishPackage(packageDir, tag);
    } finally {
        restoreStagedFiles(stagedFiles);
    }
};

releasePackage();
