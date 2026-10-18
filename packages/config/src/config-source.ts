import { SUPPORTED_EXTENSIONS } from "c12";
import { basename, extname, isAbsolute, join, resolve } from "node:path";

type ConfigResolutionOptions = { configFile?: string | undefined; cwd?: string | undefined };

const CONFIG_LOCATIONS = ["gtkx.config", ".config/gtkx", ".config/gtkx.config"];
const CONFIG_EXTENSIONS = SUPPORTED_EXTENSIONS.filter((extension) => extension !== ".cjs" && extension !== ".cts");

const configCandidatePaths = (directory: string): string[] =>
    CONFIG_LOCATIONS.flatMap((location) =>
        CONFIG_EXTENSIONS.map((extension) => join(directory, `${location}${extension}`)),
    );

const configSourceCandidates = (path: string): string[] => {
    const extension = extname(path);
    const fallback = extension === ".js" ? ".ts" : extension === ".mjs" ? ".mts" : undefined;

    if (extension.length > 0) {
        return fallback === undefined ? [path] : [path, `${path.slice(0, -extension.length)}${fallback}`];
    }

    return [
        path,
        ...CONFIG_EXTENSIONS.flatMap((candidate) => [`${path}${candidate}`, join(path, `index${candidate}`)]),
    ];
};

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

export { configCandidatePaths, configSourceCandidates, localConfigSourcePath, type ConfigResolutionOptions };
