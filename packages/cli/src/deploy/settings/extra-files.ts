import type { DeployConfig, DeployExtraFile } from "../types.js";

type ExtraFiles = NonNullable<DeployConfig["extraFiles"]>;
type ExtraFileEntry = NonNullable<ExtraFiles[string]>;

const OCTAL_RADIX = 8;

const resolveExtraFile = (destination: string, entry: ExtraFileEntry): DeployExtraFile => {
    if (typeof entry === "string") {
        return { destination, source: entry, mode: null };
    }

    const mode = entry.mode === undefined ? null : Number.parseInt(entry.mode, OCTAL_RADIX);

    return { destination, source: entry.source, mode };
};

const resolveExtraFiles = (deploy: DeployConfig): DeployExtraFile[] =>
    Object.entries(deploy.extraFiles ?? {}).map(([destination, entry]) => resolveExtraFile(destination, entry));

export { resolveExtraFiles };
