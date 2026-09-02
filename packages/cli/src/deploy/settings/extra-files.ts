import { statSync } from "node:fs";
import { resolve } from "node:path";
import type { DeployConfig, DeployExtraFile } from "../types.js";

type ExtraFiles = NonNullable<DeployConfig["extraFiles"]>;
type ExtraFileEntry = NonNullable<ExtraFiles[string]>;

const OCTAL_RADIX = 8;

const assertSourceFile = (root: string, file: DeployExtraFile): void => {
    const source = resolve(root, file.source);

    try {
        if (statSync(source).isFile()) {
            return;
        }
    } catch {
        throw new Error(`Cannot install "${file.destination}": its source file "${file.source}" does not exist`);
    }

    throw new Error(`Cannot install "${file.destination}": its source "${file.source}" is not a file`);
};

const resolveExtraFile = (destination: string, entry: ExtraFileEntry): DeployExtraFile => {
    if (typeof entry === "string") {
        return { destination, source: entry, mode: null };
    }

    const mode = entry.mode === undefined ? null : Number.parseInt(entry.mode, OCTAL_RADIX);

    return { destination, source: entry.source, mode };
};

const resolveExtraFiles = (root: string, deploy: DeployConfig): DeployExtraFile[] => {
    const files = Object.entries(deploy.extraFiles ?? {})
        .map(([destination, entry]) => resolveExtraFile(destination, entry));

    for (const file of files) {
        assertSourceFile(root, file);
    }

    return files;
};

export { resolveExtraFiles };
