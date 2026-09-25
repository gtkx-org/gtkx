import { basename, extname, isAbsolute, resolve } from "node:path";

type ConfigResolutionOptions = { configFile?: string | undefined; cwd?: string | undefined };

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

export { localConfigSourcePath, type ConfigResolutionOptions };
