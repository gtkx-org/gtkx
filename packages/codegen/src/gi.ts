import { computeGiFingerprint } from "./fingerprint.js";
import type { Library } from "./gir/library.js";
import { namespaceDirectory } from "./gir/namespace.js";
import { generateNamespaceModule } from "./store/gi/pipeline.js";
import { type GiNamespaceInput, type GiStoreOptions, writeGiStore } from "./store/gi-store.js";

export { isGiStoreFresh } from "./fingerprint.js";
export type { GiStoreOptions } from "./store/gi-store.js";

/**
 * Generates the `@gtkx/gi` store from the loaded GIR library and links it into the project. This is the
 * react-free half of codegen: it can run before `@gtkx/gi` (or `@gtkx/react`) exists, since it produces them.
 *
 * @returns The number of namespaces written.
 */
export const runGiCodegen = (library: Library, gi: GiStoreOptions, libraries: string[]): number => {
    const namespaces: GiNamespaceInput[] = [];
    for (const namespace of library.namespaces.values()) {
        namespaces.push({
            directory: namespaceDirectory(namespace),
            rawSource: generateNamespaceModule(namespace, library),
        });
    }
    writeGiStore(gi, namespaces, computeGiFingerprint(library.girFiles, [...libraries]));
    return library.namespaces.size;
};
