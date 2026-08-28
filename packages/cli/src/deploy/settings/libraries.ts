import type { Config } from "@gtkx/config";
import {
    resolveLibraries as expandLibraries,
    type GeneratedLibraries,
    readGeneratedLibraries,
    resolveGirPath,
    resolveStore,
} from "@gtkx/codegen";
import { resolveFuture } from "@gtkx/config/internal";

type ResolvedLibraries = {
    libraries: string[];
    minimumLibraryVersions: Record<string, string>;
};

const generatedLibraries = (root: string): GeneratedLibraries | null => {
    try {
        return readGeneratedLibraries(resolveStore(root).gi.storeDir);
    } catch {
        return null;
    }
};

const discoveredLibraries = (config: Config, isAdwaitaDefault: boolean): string[] | null => {
    try {
        return expandLibraries(config.libraries, resolveGirPath(config.girPath), isAdwaitaDefault);
    } catch {
        return null;
    }
};

const configLibraries = (config: Config): string[] => {
    const { isAdwaitaDefault } = resolveFuture(config.future);
    const libraries = config.libraries;

    if (Array.isArray(libraries)) {
        return expandLibraries(libraries, [], isAdwaitaDefault);
    }

    return discoveredLibraries(config, isAdwaitaDefault) ?? expandLibraries(undefined, [], isAdwaitaDefault);
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
