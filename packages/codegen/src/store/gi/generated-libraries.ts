import { sortStrings } from "@gtkx/utils";
import { join } from "node:path";
import type { GirNamespace } from "../../gir/namespace.js";
import { arrayGuard, hasFields, isString, recordGuard } from "../../guards.js";
import { readJsonFile } from "../../json.js";

/** What a generated `@gtkx/gi` store binds, and the library releases it was generated against. */
type GeneratedLibraries = {
    /** GIR identifiers the store binds, such as `Gtk-4.0`, expanded from the project's `libraries`. */
    libraries: string[];
    /**
     * `MAJOR.MINOR` release, keyed by GIR identifier. A library whose GIR declares no `MAJOR_VERSION`
     * and `MINOR_VERSION` is absent, so an entry is present only for those that name their release.
     */
    versions: Record<string, string>;
};

const LIBRARIES_FILENAME = "libraries.json";
const MAJOR_CONSTANT = "MAJOR_VERSION";
const MINOR_CONSTANT = "MINOR_VERSION";
const DIGITS = /^\d+$/;

const constantValue = (namespace: GirNamespace, name: string): string | undefined => {
    const constant = namespace.constants.find((entry) => entry.name === name);

    return constant !== undefined && DIGITS.test(constant.value) ? constant.value : undefined;
};

const namespaceVersion = (namespace: GirNamespace): string | undefined => {
    const major = constantValue(namespace, MAJOR_CONSTANT);
    const minor = constantValue(namespace, MINOR_CONSTANT);

    return major === undefined || minor === undefined ? undefined : `${major}.${minor}`;
};

const getNamespaceName = (library: string): string => {
    const separator = library.indexOf("-");

    return separator === -1 ? library : library.slice(0, separator);
};

const collectGeneratedLibraries = (
    namespaces: Map<string, GirNamespace>,
    libraries: string[],
): GeneratedLibraries => {
    const sorted = sortStrings(libraries);
    const versions: Record<string, string> = {};

    for (const library of sorted) {
        const namespace = namespaces.get(getNamespaceName(library));
        const version = namespace === undefined ? undefined : namespaceVersion(namespace);

        if (version !== undefined) {
            versions[library] = version;
        }
    }

    return { libraries: sorted, versions };
};

const renderGeneratedLibraries = (generated: GeneratedLibraries): string =>
    `${JSON.stringify(generated, null, 2)}\n`;

const isGeneratedLibraries = (value: unknown): value is GeneratedLibraries =>
    hasFields<GeneratedLibraries>(value, {
        libraries: arrayGuard(isString),
        versions: recordGuard(isString),
    });

/**
 * Reads which GIR libraries a generated `@gtkx/gi` store binds and which release of each its GIR declared,
 * out of the inventory codegen writes into the store. Answers "what does this project bind, and how new does
 * the installed library have to be" without parsing a `.gir` file or querying pkg-config.
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
