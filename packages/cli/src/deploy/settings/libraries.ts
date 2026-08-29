import type { Config } from "@gtkx/config";
import {
    resolveLibraries as expandLibraries,
    type GeneratedLibraries,
    readGeneratedLibraries,
    resolveStore,
} from "@gtkx/codegen";

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

const resolveLibraries = (root: string, config: Config): ResolvedLibraries => {
    const generated = generatedLibraries(root);
    const libraries = generated?.libraries ?? expandLibraries(config.libraries);
    const deploy = config.deploy ?? {};

    return {
        libraries,
        minimumLibraryVersions: deploy.minimumLibraryVersions ?? {},
    };
};

export { resolveLibraries };
