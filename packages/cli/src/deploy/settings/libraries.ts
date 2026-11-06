import type { Config } from "@gtkx/config";
import {
    resolveLibraries as expandLibraries,
    type GeneratedLibraries,
    readGeneratedLibraries,
    resolveStore,
} from "@gtkx/codegen";
import { resolveBoundLibraries } from "@gtkx/codegen/internal";

type ResolvedLibraries = {
    libraries: string[];
    sharedLibraries: Record<string, string[]>;
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
    const libraries = resolveBoundLibraries(
        (config.codegen === false ? generated?.libraries : undefined) ?? expandLibraries(config.libraries),
    );
    const deploy = config.deploy ?? {};

    return {
        libraries,
        sharedLibraries: generated?.sharedLibraries ?? {},
        minimumLibraryVersions: deploy.minimumLibraryVersions ?? {},
    };
};

export { resolveLibraries };
