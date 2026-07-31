import type { Library } from "./gir/library.js";
import type { StoreOptions } from "./store/store-fs.js";
import { computeGiFingerprint } from "./fingerprint.js";
import { namespaceDirectory } from "./gir/namespace.js";
import { type GiNamespaceInput, writeGiStore } from "./store/gi-store.js";
import { generateNamespaceModule } from "./store/gi/pipeline.js";

type GiCodegenOptions = {
    gi: StoreOptions;
    libraries: string[];
    girPath: string[];
};

/**
 * Generates the `@gtkx/gi` store from the loaded GIR library and links it into the project. This is the
 * react-free half of codegen: it can run before `@gtkx/gi` (or `@gtkx/react`) exists, since it produces them.
 *
 * @returns The number of namespaces written.
 */
const runGiCodegen = (library: Library, options: GiCodegenOptions): number => {
    const { gi, libraries, girPath } = options;

    const namespaces: GiNamespaceInput[] = Array.from(library.namespaces.values(), (namespace) => ({
        directory: namespaceDirectory(namespace),
        rawSource: generateNamespaceModule(namespace, library),
    }));

    const fingerprint = computeGiFingerprint(library.girFiles, [...libraries], [...girPath]);
    writeGiStore(gi, namespaces, fingerprint);

    return library.namespaces.size;
};

export { runGiCodegen, type GiCodegenOptions };
