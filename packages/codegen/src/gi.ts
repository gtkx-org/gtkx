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
