import { sortStringsBy } from "@gtkx/utils";
import { type Stats, statSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import type { DeployConfig, DeployExtraFile } from "../types.js";
import { listFilesRecursive } from "../../internal/list-files.js";

type ExtraFiles = NonNullable<DeployConfig["extraFiles"]>;
type ExtraFileEntry = NonNullable<ExtraFiles[string]>;

const OCTAL_RADIX = 8;

const statSource = (root: string, file: DeployExtraFile): Stats => {
    try {
        return statSync(resolve(root, file.source));
    } catch {
        throw new Error(`Cannot install "${file.destination}": its source "${file.source}" does not exist`);
    }
};

const sourceStats = (root: string, file: DeployExtraFile): Stats => {
    const stats = statSource(root, file);

    if (!stats.isFile() && !stats.isDirectory()) {
        throw new Error(`Cannot install "${file.destination}": its source "${file.source}" is not a file or directory`);
    }

    return stats;
};

const expandDirectory = (root: string, file: DeployExtraFile): DeployExtraFile[] =>
    sortStringsBy(listFilesRecursive(resolve(root, file.source)), (entry) => entry.rel).map((entry) => ({
        destination: join(file.destination, entry.rel),
        source: join(file.source, entry.rel),
        mode: file.mode,
    }));

const expandExtraFile = (root: string, file: DeployExtraFile): DeployExtraFile[] =>
    sourceStats(root, file).isDirectory() ? expandDirectory(root, file) : [file];

const resolveExtraFile = (destination: string, entry: ExtraFileEntry): DeployExtraFile => {
    const normalizedDestination = normalize(destination);

    if (typeof entry === "string") {
        return { destination: normalizedDestination, source: entry, mode: null };
    }

    const mode = entry.mode === undefined ? null : Number.parseInt(entry.mode, OCTAL_RADIX);

    return { destination: normalizedDestination, source: entry.source, mode };
};

const resolveExtraFiles = (root: string, deploy: DeployConfig): DeployExtraFile[] =>
    Object.entries(deploy.extraFiles ?? {}).flatMap(([destination, entry]) =>
        expandExtraFile(root, resolveExtraFile(destination, entry)),
    );

export { resolveExtraFiles };
