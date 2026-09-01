import type { Config } from "@gtkx/config";
import { isPathInside } from "@gtkx/utils";
import { statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DeployConfig, DeployPaths } from "../types.js";
import { resolveApplicationIcon } from "../../internal/icon-path.js";

type PathsRequest = {
    root: string;
    deploy: DeployConfig;
    applicationIcon: Config["applicationIcon"];
    applicationId: Config["applicationId"];
    outDirOverride: string | undefined;
};

const DEFAULT_OUT_DIR = "build";
const DIST_DIR = "dist";
const LICENSE_CANDIDATES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "COPYING.md"];

const resolveOutDir = ({ root, deploy, outDirOverride }: PathsRequest): string => {
    const configured = outDirOverride ?? deploy.outDir ?? DEFAULT_OUT_DIR;
    const outDir = resolve(root, configured);

    if (!isPathInside(root, outDir)) {
        throw new Error(`Cannot use "${configured}" as the deploy output directory: it is outside ${root}`);
    }

    return outDir;
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

export { resolvePaths };
