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
 * Reads which GIR libraries a generated `@gtkx/gi` store binds out of the inventory codegen writes into the store.
 *
 * @param giStoreDir The gi store directory, as given by `resolveStore(projectRoot).gi.storeDir`.
 * @returns What the store recorded, or null when it holds no inventory codegen wrote, which covers an absent,
 * unreadable, unparseable and structurally foreign store file alike.
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
