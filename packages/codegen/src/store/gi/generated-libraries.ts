import { isRecord, sortStrings } from "@gtkx/utils";
import { join } from "node:path";
import type { GirNamespace } from "../../gir/namespace.js";
import { getNamespace } from "../../gir/libraries.js";
import { arrayGuard, hasFields, isString } from "../../guards.js";
import { readJsonFile } from "../../json.js";

/** What a generated `@gtkx/gi` store binds. */
type GeneratedLibraries = {
    /** GIR identifiers the store binds, such as `Gtk-4.0`, expanded from the project's `libraries`. */
    libraries: string[];
    /**
     * Shared libraries each bound GIR library loads, keyed by GIR identifier, from the `shared-library` attribute of
     * its GIR, such as `libgtk-4.so.1` for `Gtk-4.0`. Absent from stores generated before GTKX recorded them.
     */
    sharedLibraries?: Record<string, string[]> | undefined;
};

const LIBRARIES_FILENAME = "libraries.json";
const SHARED_LIBRARY_SEPARATOR = ",";

const sharedLibrariesOf = (namespace: GirNamespace | undefined): string[] =>
    (namespace?.sharedLibrary ?? "")
        .split(SHARED_LIBRARY_SEPARATOR)
        .map((soname) => soname.trim())
        .filter((soname) => soname.length > 0);

const collectGeneratedLibraries = (
    libraries: string[],
    namespaces: ReadonlyMap<string, GirNamespace>,
): GeneratedLibraries => {
    const sorted = sortStrings(libraries);

    return {
        libraries: sorted,
        sharedLibraries: Object.fromEntries(
            sorted.map((library) => [library, sharedLibrariesOf(namespaces.get(getNamespace(library)))]),
        ),
    };
};

const renderGeneratedLibraries = (generated: GeneratedLibraries): string => `${JSON.stringify(generated, null, 2)}\n`;

const isSharedLibraries = (value: unknown): value is Record<string, string[]> | undefined =>
    value === undefined || (isRecord(value) && Object.values(value).every(arrayGuard(isString)));

const isGeneratedLibraries = (value: unknown): value is GeneratedLibraries =>
    hasFields<GeneratedLibraries>(value, {
        libraries: arrayGuard(isString),
        sharedLibraries: isSharedLibraries,
    });

/**
 * Reads the GIR library inventory written into a generated GI store.
 *
 * @param giStoreDir Generated GI store directory.
 * @returns The recorded libraries, or null if the inventory is absent, unreadable, unparseable,
 * or has an unrecognized structure.
 */
const readGeneratedLibraries = (giStoreDir: string): GeneratedLibraries | null => {
    const parsed = readJsonFile(join(giStoreDir, LIBRARIES_FILENAME));

    return isGeneratedLibraries(parsed) ? parsed : null;
};

export {
    LIBRARIES_FILENAME,
    collectGeneratedLibraries,
    type GeneratedLibraries,
    readGeneratedLibraries,
    renderGeneratedLibraries,
};
