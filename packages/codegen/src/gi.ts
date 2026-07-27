import type { Library } from "./gir/library.js";
import { computeGiFingerprint } from "./fingerprint.js";
import { namespaceDirectory } from "./gir/namespace.js";
import { type GiNamespaceInput, type GiStoreOptions, writeGiStore } from "./store/gi-store.js";
import { generateNamespaceModule } from "./store/gi/pipeline.js";

/**
 * Generates the `@gtkx/gi` store from the loaded GIR library and links it into the project. This is the
 * react-free half of codegen: it can run before `@gtkx/gi` (or `@gtkx/react`) exists, since it produces them.
 *
 * @returns The number of namespaces written.
 */
const runGiCodegen = (library: Library, gi: GiStoreOptions, libraries: string[], girPath: string[]): number => {
    const namespaces: GiNamespaceInput[] = Array.from(library.namespaces.values(), (namespace) => ({
        directory: namespaceDirectory(namespace),
        rawSource: generateNamespaceModule(namespace, library),
    }));

    writeGiStore(gi, namespaces, computeGiFingerprint(library.girFiles, [...libraries], [...girPath]));

    return library.namespaces.size;
};

export { isGiStoreFresh } from "./fingerprint.js";
export type { GiStoreOptions } from "./store/gi-store.js";
export { runGiCodegen };
