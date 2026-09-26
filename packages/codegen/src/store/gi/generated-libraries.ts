import { sortStrings } from "@gtkx/utils";
import { join } from "node:path";
import { arrayGuard, hasFields, isString } from "../../guards.js";
import { readJsonFile } from "../../json.js";

/** What a generated `@gtkx/gi` store binds. */
type GeneratedLibraries = {
    /** GIR identifiers the store binds, such as `Gtk-4.0`, expanded from the project's `libraries`. */
    libraries: string[];
};

const LIBRARIES_FILENAME = "libraries.json";
const collectGeneratedLibraries = (libraries: string[]): GeneratedLibraries => ({
    libraries: sortStrings(libraries),
});

const renderGeneratedLibraries = (generated: GeneratedLibraries): string =>
    `${JSON.stringify(generated, null, 2)}\n`;

const isGeneratedLibraries = (value: unknown): value is GeneratedLibraries =>
    hasFields<GeneratedLibraries>(value, {
        libraries: arrayGuard(isString),
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
