import { sortStrings } from "@gtkx/utils";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

type GirNamespace = {
    name: string;
    version: string;
    identifier: string;
};

/** A `libraries` config value: an explicit list or absent for the default. */
type LibrarySelection = string[] | undefined;

const GIR_LIBRARY_PATTERN = /^[A-Za-z][A-Za-z0-9]*-\d+(?:\.\d+)*$/;
const DEFAULT_LIBRARIES: string[] = ["Adw-1"];
const TRANSITIVE_GTK_LIBRARY = "Gtk-4.0";
const GIR_FILE_SUFFIX = ".gir";

const locateGirFile = (identifier: string, girPath: string[]): string => {
    const filename = `${identifier}${GIR_FILE_SUFFIX}`;

    for (const directory of girPath) {
        const candidate = join(directory, filename);

        if (existsSync(candidate)) {
            return candidate;
        }
    }

    const tried = girPath.map((directory) => join(directory, filename)).join(", ");
    throw new Error(`GIR file ${filename} not found on girPath. Tried: ${tried}`);
};

/**
 * Expands a `libraries` config value into the GIR identifiers to generate from, adding Adwaita when the
 * selection does not already name another version. Adwaita's GIR pulls in GTK and its dependencies.
 */
const resolveLibraries = (libraries: LibrarySelection): string[] => {
    const selected = libraries ?? [];
    const named: Set<string> = new Set(selected.map((entry) => getNamespace(entry)));
    const missing = DEFAULT_LIBRARIES.filter((library) => !named.has(getNamespace(library)));

    return [...new Set([...missing, ...selected])];
};

const resolveBoundLibraries = (libraries: string[]): string[] => {
    const namespaces = new Set(libraries.map((library) => getNamespace(library)));

    return namespaces.has("Adw") && !namespaces.has("Gtk")
        ? libraries.flatMap((library) => getNamespace(library) === "Adw" ? [library, TRANSITIVE_GTK_LIBRARY] : library)
        : libraries;
};

const getNamespace = (library: string): string => {
    const separator = library.indexOf("-");

    return separator === -1 ? library : library.slice(0, separator);
};

const readDirEntries = (dir: string): string[] => {
    try {
        return readdirSync(dir);
    } catch {
        return [];
    }
};

const parseGirNamespace = (entry: string): GirNamespace | undefined => {
    if (!entry.endsWith(GIR_FILE_SUFFIX)) {
        return undefined;
    }

    const identifier = entry.slice(0, -GIR_FILE_SUFFIX.length);

    if (!GIR_LIBRARY_PATTERN.test(identifier)) {
        return undefined;
    }

    const separator = identifier.indexOf("-");

    return { name: identifier.slice(0, separator), version: identifier.slice(separator + 1), identifier };
};

const recordHighest = (highestByName: Map<string, GirNamespace>, parsed: GirNamespace): void => {
    const existing = highestByName.get(parsed.name);

    if (existing === undefined || compareVersions(parsed.version, existing.version) > 0) {
        highestByName.set(parsed.name, parsed);
    }
};

const collectDirNamespaces = (highestByName: Map<string, GirNamespace>, dir: string): void => {
    for (const entry of readDirEntries(dir)) {
        const parsed = parseGirNamespace(entry);

        if (parsed !== undefined) {
            recordHighest(highestByName, parsed);
        }
    }
};

/**
 * Every GIR library installed on the search path, as sorted `Name-Version` identifiers. A namespace found
 * in more than one version contributes only its highest, and unreadable directories are skipped.
 */
const discoverGirNamespaces = (girPath: string[]): string[] => {
    const highestByName: Map<string, GirNamespace> = new Map();

    for (const dir of girPath) {
        collectDirNamespaces(highestByName, dir);
    }

    return sortStrings(highestByName.values().map(({ identifier }) => identifier));
};

const compareVersions = (a: string, b: string): number => {
    const aParts = a.split(".");
    const bParts = b.split(".");
    const length = Math.max(aParts.length, bParts.length);

    for (let index = 0; index < length; index += 1) {
        const difference = Number(aParts[index] ?? 0) - Number(bParts[index] ?? 0);

        if (difference !== 0) {
            return difference;
        }
    }

    return 0;
};

export { resolveBoundLibraries, resolveLibraries, discoverGirNamespaces, locateGirFile, type LibrarySelection };
