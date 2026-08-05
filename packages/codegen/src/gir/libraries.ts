import { sortStrings } from "@gtkx/utils";
import { readdirSync } from "node:fs";

/** A namespace found on the GIR path, taken from the name of its `.gir` file. */
type GirNamespace = {
    /** Namespace the file describes, such as `Gtk`. */
    name: string;
    /** API version the file describes, such as `4.0`. */
    version: string;
    /** Name and version joined the way a `libraries` entry spells them, such as `Gtk-4.0`. */
    identifier: string;
};

/** A `libraries` config value: an explicit list, `"*"` for everything installed, or absent for the default. */
type LibrarySelection = "*" | string[] | undefined;

const LIBRARIES_WILDCARD = "*";
const GIR_LIBRARY_PATTERN = /^[A-Za-z][A-Za-z0-9]*-\d+(?:\.\d+)*$/;
const DEFAULT_LIBRARIES: string[] = ["Gtk-4.0"];
const GIR_FILE_SUFFIX = ".gir";

/**
 * Expands a `libraries` config value into the GIR identifiers to generate from: `"Gtk-4.0"` alone when
 * nothing is configured, everything installed for `"*"`, and otherwise the given list with `"Gtk-4.0"`
 * prepended unless it already names a Gtk version.
 *
 * @throws If `"*"` matched no `.gir` file anywhere on the GIR path.
 */
const resolveLibraries = (libraries: LibrarySelection, girPath: string[]): string[] => {
    if (libraries === undefined) {
        return [...DEFAULT_LIBRARIES];
    }

    if (libraries === LIBRARIES_WILDCARD) {
        const discovered = discoverGirNamespaces(girPath);

        if (discovered.length === 0) {
            throw new Error(
                `gtkx.config.ts: \`libraries: "*"\` matched no .gir files in [${girPath.join(", ")}]. ` +
                "Install gobject-introspection data packages, or list the libraries explicitly.",
            );
        }

        return discovered;
    }

    const hasGtk = libraries.some((library) => library.startsWith("Gtk-"));

    return [...new Set([...(hasGtk ? [] : DEFAULT_LIBRARIES), ...libraries])];
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

export { resolveLibraries, discoverGirNamespaces, type LibrarySelection };
