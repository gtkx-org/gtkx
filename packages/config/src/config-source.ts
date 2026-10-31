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

const localConfigSourcePaths = (source: string, options: ConfigResolutionOptions): string[] => {
    if (source === "." || !isLocalConfigSource(source)) {
        return [];
    }

    const path = resolve(options.cwd ?? process.cwd(), source);

    if (!isDirectoryConfigSource(source)) {
        return [path];
    }

    return options.configFile === undefined || options.configFile === CONFIG_LOCATIONS[0]
        ? configCandidatePaths(path)
        : [join(path, options.configFile)];
};

export { configCandidatePaths, configSourceCandidates, localConfigSourcePaths, type ConfigResolutionOptions };
