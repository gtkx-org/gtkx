import type { Config } from "@gtkx/config";
import {
    resolveLibraries as expandLibraries,
    type GeneratedLibraries,
    readGeneratedLibraries,
    resolveGirPath,
    resolveStore,
} from "@gtkx/codegen";
import type { DeployConfig } from "../types.js";
import { PACKAGED_LIBRARIES } from "../depends.js";
import { readSharedLibraries } from "./shared-library.js";

type ResolvedLibraries = {
    libraries: string[];
    libraryFloors: Record<string, string>;
    librarySonames: Record<string, string[]>;
    unreadableLibraries: string[];
    hasDiscoveredLibraries: boolean;
};

type ResolvedSonames = Pick<ResolvedLibraries, "librarySonames" | "unreadableLibraries">;

const DEFAULT_LIBRARY = "Gtk-4.0";
const DEFAULT_LIBRARY_PREFIX = "Gtk-";
const LIBRARIES_WILDCARD = "*";

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

const floorFor = (deploy: DeployConfig, library: string, detected: string | undefined): string | undefined => {
    const floors = deploy.libraryFloors;

    if (floors === false) {
        return undefined;
    }

    const override = floors?.[library];

    if (override === false) {
        return undefined;
    }

    return override ?? detected;
};

const libraryFloors = (
    deploy: DeployConfig,
    libraries: string[],
    versions: Record<string, string>,
): Record<string, string> => {
    const floors: Record<string, string> = {};

    for (const library of libraries) {
        const floor = floorFor(deploy, library, versions[library]);

        if (floor !== undefined) {
            floors[library] = floor;
        }
    }

    return floors;
};

const searchPath = (config: Config): string[] | null => {
    try {
        return resolveGirPath(config.girPath);
    } catch {
        return null;
    }
};

const sonamesFor = (unpackaged: string[], girPath: string[]): ResolvedSonames => {
    const librarySonames: Record<string, string[]> = {};
    const unreadableLibraries: string[] = [];

    for (const library of unpackaged) {
        const sonames = readSharedLibraries(library, girPath);

        if (sonames === null) {
            unreadableLibraries.push(library);
        } else {
            librarySonames[library] = sonames;
        }
    }

    return { librarySonames, unreadableLibraries };
};

const resolveSonames = (libraries: string[], config: Config): ResolvedSonames => {
    const unpackaged = libraries.filter((library) => !PACKAGED_LIBRARIES.includes(library));

    if (unpackaged.length === 0) {
        return { librarySonames: {}, unreadableLibraries: [] };
    }

    const girPath = searchPath(config);

    return girPath === null ? { librarySonames: {}, unreadableLibraries: unpackaged } : sonamesFor(unpackaged, girPath);
};

const resolveLibraries = (root: string, config: Config): ResolvedLibraries => {
    const generated = generatedLibraries(root);
    const libraries = generated?.libraries ?? configLibraries(config);
    const deploy = config.deploy ?? {};

    return {
        libraries,
        libraryFloors: libraryFloors(deploy, libraries, generated?.versions ?? {}),
        ...resolveSonames(libraries, config),
        hasDiscoveredLibraries: config.libraries === LIBRARIES_WILDCARD,
    };
};

export { resolveLibraries };
