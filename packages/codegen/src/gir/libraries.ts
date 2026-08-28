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
const ADWAITA_DEFAULT_LIBRARIES: string[] = ["Gtk-4.0", "Adw-1"];
const GIR_FILE_SUFFIX = ".gir";

/**
 * Expands a `libraries` config value into the GIR identifiers to generate from: the mandatory set alone
 * when nothing is configured, everything installed for `"*"`, and otherwise the given list with the
 * mandatory set prepended.
 *
 * The mandatory set is `"Gtk-4.0"`, which joins a list that does not already name a Gtk version. Under
 * `isAdwaitaDefault` it is `"Gtk-4.0"` and `"Adw-1"`, and it joins `"*"` as well as an explicit list.
 * Each entry is mandatory by namespace rather than by version, so a list that pins another version of
 * Gtk or Adwaita keeps its pin.
 *
 * @throws If `"*"` matched no `.gir` file anywhere on the GIR path.
 */
const resolveLibraries = (libraries: LibrarySelection, girPath: string[], isAdwaitaDefault = false): string[] => {
    if (libraries === undefined) {
        return [...mandatoryLibraries(isAdwaitaDefault)];
    }

    if (libraries === LIBRARIES_WILDCARD) {
        return installedLibraries(girPath, isAdwaitaDefault);
    }

    if (isAdwaitaDefault) {
        return withMandatory(ADWAITA_DEFAULT_LIBRARIES, libraries);
    }

    return withDefaultGtk(libraries);
};

const redundantLibraries = (libraries: LibrarySelection, isAdwaitaDefault = false): string[] => {
    if (!isAdwaitaDefault || !Array.isArray(libraries)) {
        return [];
    }

    return libraries.filter((entry) => ADWAITA_DEFAULT_LIBRARIES.includes(entry));
};

const mandatoryLibraries = (isAdwaitaDefault: boolean): string[] =>
    isAdwaitaDefault ? ADWAITA_DEFAULT_LIBRARIES : DEFAULT_LIBRARIES;

const installedLibraries = (girPath: string[], isAdwaitaDefault: boolean): string[] => {
    const discovered = discoverGirNamespaces(girPath);

    if (discovered.length === 0) {
        throw new Error(
            `gtkx.config.ts: \`libraries: "*"\` matched no .gir files in [${girPath.join(", ")}]. ` +
            "Install gobject-introspection data packages, or list the libraries explicitly.",
        );
    }

    if (isAdwaitaDefault) {
        return withMandatory(ADWAITA_DEFAULT_LIBRARIES, discovered);
    }

    return discovered;
};

const getNamespace = (library: string): string => {
    const separator = library.indexOf("-");

    return separator === -1 ? library : library.slice(0, separator);
};

const withMandatory = (mandatory: string[], selected: string[]): string[] => {
    const named: Set<string> = new Set(selected.map((entry) => getNamespace(entry)));
    const missing = mandatory.filter((library) => !named.has(getNamespace(library)));

    return [...new Set([...missing, ...selected])];
};

const withDefaultGtk = (libraries: string[]): string[] => {
    if (libraries.some((library) => library.startsWith("Gtk-"))) {
        return [...new Set(libraries)];
    }

    return [...new Set([...DEFAULT_LIBRARIES, ...libraries])];
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

export { resolveLibraries, redundantLibraries, discoverGirNamespaces, LIBRARIES_WILDCARD, type LibrarySelection };
