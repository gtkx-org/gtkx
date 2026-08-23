import type { Config } from "@gtkx/config";
import {
    resolveLibraries as expandLibraries,
    type GeneratedLibraries,
    readGeneratedLibraries,
    resolveGirPath,
    resolveStore,
} from "@gtkx/codegen";

type ResolvedLibraries = {
    libraries: string[];
    minimumLibraryVersions: Record<string, string>;
};

const DEFAULT_LIBRARY = "Gtk-4.0";
const DEFAULT_LIBRARY_PREFIX = "Gtk-";

const generatedLibraries = (root: string): GeneratedLibraries | null => {
    try {
        return readGeneratedLibraries(resolveStore(root).gi.storeDir);
    } catch {
        return null;
    }
};

const discoveredLibraries = (config: Config): string[] | null => {
    try {
        return expandLibraries(config.libraries, resolveGirPath(config.girPath));
    } catch {
        return null;
    }
};

const configLibraries = (config: Config): string[] => {
    const libraries = config.libraries;

    if (!Array.isArray(libraries)) {
        return discoveredLibraries(config) ?? [DEFAULT_LIBRARY];
    }

    return libraries.some((library) => library.startsWith(DEFAULT_LIBRARY_PREFIX))
        ? [...libraries]
        : [DEFAULT_LIBRARY, ...libraries];
};

const resolveLibraries = (root: string, config: Config): ResolvedLibraries => {
    const generated = generatedLibraries(root);
    const libraries = generated?.libraries ?? configLibraries(config);
    const deploy = config.deploy ?? {};

    return {
        libraries,
        minimumLibraryVersions: deploy.minimumLibraryVersions ?? {},
    };
};

export { resolveLibraries };
