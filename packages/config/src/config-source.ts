import { SUPPORTED_EXTENSIONS } from "c12";
import { basename, extname, isAbsolute, join, resolve } from "node:path";

type ConfigResolutionOptions = { configFile?: string | undefined; cwd?: string | undefined };

const CONFIG_LOCATIONS = ["gtkx.config", ".config/gtkx", ".config/gtkx.config"];

const configCandidatePaths = (directory: string): string[] =>
    CONFIG_LOCATIONS.flatMap((location) =>
        SUPPORTED_EXTENSIONS.filter((extension) => extension !== ".cjs" && extension !== ".cts").map((extension) =>
            join(directory, `${location}${extension}`),
        ),
    );

const isLocalConfigSource = (source: string): boolean => source.startsWith(".") || isAbsolute(source);

const isDirectoryConfigSource = (source: string): boolean => {
    const extension = extname(source);

    return extension.length === 0 || extension === basename(source);
};

const localConfigSourcePath = (source: string, options: ConfigResolutionOptions): string | undefined => {
    if (source === "." || !isLocalConfigSource(source)) {
        return undefined;
    }

    const cwd = options.cwd ?? process.cwd();

    return isDirectoryConfigSource(source)
        ? resolve(cwd, source, options.configFile ?? "gtkx.config")
        : resolve(cwd, source);
};

export { configCandidatePaths, localConfigSourcePath, type ConfigResolutionOptions };
