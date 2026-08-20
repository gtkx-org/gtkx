import type { Library } from "./gir/library.js";
import type { StoreOptions } from "./store/store-fs.js";
import { computeGiFingerprint } from "./fingerprint.js";
import { externalPackageFor } from "./gir/external-namespaces.js";
import { namespaceDirectory } from "./gir/namespace.js";
import { type GiExternalNamespaceInput, type GiNamespaceInput, writeGiStore } from "./store/gi-store.js";
import { generateNamespaceModule } from "./store/gi/pipeline.js";

type GiCodegenOptions = {
    gi: StoreOptions;
    libraries: string[];
    girPath: string[];
    isByteArrayTyped: boolean;
    isValueUnwrapped: boolean;
};

type SplitNamespaces = {
    namespaces: GiNamespaceInput[];
    externalNamespaces: GiExternalNamespaceInput[];
};

const splitNamespaces = (library: Library): SplitNamespaces => {
    const namespaces: GiNamespaceInput[] = [];
    const externalNamespaces: GiExternalNamespaceInput[] = [];

    for (const namespace of library.namespaces.values()) {
        const packageName = externalPackageFor(namespace.name);

        if (packageName !== undefined) {
            externalNamespaces.push({
                directory: namespaceDirectory(namespace),
                packageName,
                girFile: namespace.girFile,
            });

            continue;
        }

        namespaces.push({
            directory: namespaceDirectory(namespace),
            rawSource: generateNamespaceModule(namespace, library),
            girFile: namespace.girFile,
        });
    }

    return { namespaces, externalNamespaces };
};

const runGiCodegen = (library: Library, options: GiCodegenOptions): number => {
    const { gi, libraries, girPath, isByteArrayTyped, isValueUnwrapped } = options;
    const { namespaces, externalNamespaces } = splitNamespaces(library);

    const fingerprint = computeGiFingerprint({
        girFiles: library.girFiles,
        libraries: [...libraries],
        girPath: [...girPath],
        storeVersion: gi.version,
        isByteArrayTyped,
        isValueUnwrapped,
    });

    writeGiStore(gi, namespaces, externalNamespaces, fingerprint);

    return library.namespaces.size;
};

export { runGiCodegen };
