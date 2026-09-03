import type { Config } from "@gtkx/config";
import { isPathInside } from "@gtkx/utils";
import { lstatSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { DeployConfig, DeployPaths } from "../types.js";
import { resolveApplicationIcon } from "../../internal/icon-path.js";
import { prepareOutputDirectory, readRegularFile } from "../../internal/output-directory.js";

type PathsRequest = {
    root: string;
    deploy: DeployConfig;
    applicationIcon: Config["applicationIcon"];
    applicationId: Config["applicationId"];
    outDirOverride: string | undefined;
};

const DEFAULT_OUT_DIR = "build";
const DIST_DIR = "dist";
const DEPLOY_MARKER_FILENAME = ".gtkx-deploy.json";
const DEPLOY_MARKER = `${JSON.stringify({ generator: "gtkx-deploy", formatVersion: 1 })}\n`;
const LICENSE_CANDIDATES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "COPYING.md"];

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

const isDeployMarker = (path: string): boolean => {
    return readRegularFile(path) === DEPLOY_MARKER;
};

const isReusableDeployDirectory = (path: string): boolean => {
    const entry = lstatSync(path, { throwIfNoEntry: false });

    if (entry === undefined) {
        return true;
    }

    return entry.isDirectory() &&
        (readdirSync(path).length === 0 || isDeployMarker(join(path, DEPLOY_MARKER_FILENAME)));
};

const deployOutputError = (root: string, configured: string): Error =>
    new Error(
        `Cannot use "${configured}" as the deploy output directory: choose an empty directory or an ` +
        `earlier GTKX deploy directory below ${root}`,
    );

const assertSafeDeployOutDir = (root: string, outDir: string, configured: string): void => {
    const dist = join(root, DIST_DIR);

    if (
        outDir === dist ||
        !isPathInside(root, outDir) ||
        isPathInside(dist, outDir) ||
        hasSymlinkComponent(root, outDir)
    ) {
        throw deployOutputError(root, configured);
    }
};

const resolveOutDir = ({ root, deploy, outDirOverride }: PathsRequest): string => {
    const configured = outDirOverride ?? deploy.outDir ?? DEFAULT_OUT_DIR;
    const outDir = resolve(root, configured);
    assertSafeDeployOutDir(root, outDir, configured);

    if (!isReusableDeployDirectory(outDir)) {
        throw deployOutputError(root, configured);
    }

    return outDir;
};

const prepareDeployOutDir = (root: string, outDir: string): void => {
    assertSafeDeployOutDir(root, outDir, outDir);
    const prepared = prepareOutputDirectory(root, outDir, isReusableDeployDirectory);

    if (prepared.status === "unsafe") {
        throw deployOutputError(root, outDir);
    }

    using transaction = prepared.transaction;
    transaction.commit();
    writeFileSync(join(outDir, DEPLOY_MARKER_FILENAME), DEPLOY_MARKER, { flag: "wx" });
};

const existingFile = (path: string): string | null =>
    statSync(path, { throwIfNoEntry: false })?.isFile() === true ? path : null;

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

const resolvePaths = (request: PathsRequest): DeployPaths => {
    const { root, deploy } = request;
    const outDir = resolveOutDir(request);

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
        applicationIcon: resolveApplicationIcon(root, request.applicationId, request.applicationIcon),
        licenseFile: resolveLicenseFile(root, deploy.licenseFile),
        schemaFiles: [],
    };
};

export { prepareDeployOutDir, resolvePaths };
