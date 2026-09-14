import type { Library } from "./gir/library.js";
import type { PreparedStore, StoreOptions } from "./store/store-fs.js";
import { computeGiFingerprint } from "./fingerprint.js";
import { externalPackageFor } from "./gir/external-namespaces.js";
import { resolveBoundLibraries } from "./gir/libraries.js";
import { type GirNamespace, namespaceDirectory } from "./gir/namespace.js";
import { type GiNamespaceInput, writeGiStore } from "./store/gi-store.js";
import { collectGeneratedLibraries } from "./store/gi/generated-libraries.js";
import { generateNamespaceModule } from "./store/gi/pipeline.js";

type GiCodegenOptions = {
    gi: StoreOptions;
    libraries: string[];
    girPath: string[];
};

type SplitNamespaces = {
    namespaces: GiNamespaceInput[];
    externalPackages: string[];
};

type GiCodegenResult = { namespaces: number; store: PreparedStore };

const generateGiNamespace = (namespace: GirNamespace, library: Library): GiNamespaceInput => {
    const generated = generateNamespaceModule(namespace, library);

    return {
        directory: namespaceDirectory(namespace),
        rawSource: generated.source,
        rawBootstrapSource: generated.bootstrapSource,
        girFile: namespace.girFile,
    };
};

const splitNamespaces = (library: Library): SplitNamespaces => {
    const namespaces: GiNamespaceInput[] = [];
    const externalPackages: string[] = [];

    for (const namespace of library.namespaces.values()) {
        const packageName = externalPackageFor(namespace.name);

        if (packageName !== undefined) {
            externalPackages.push(packageName);
            continue;
        }

        namespaces.push(generateGiNamespace(namespace, library));
    }

    return { namespaces, externalPackages };
};

const runGiCodegen = (library: Library, options: GiCodegenOptions): GiCodegenResult => {
    const { gi, libraries, girPath } = options;
    const { namespaces, externalPackages } = splitNamespaces(library);

    const fingerprint = computeGiFingerprint({
        girFiles: library.girFiles,
        libraries: [...libraries],
        girPath: [...girPath],
        storeVersion: gi.version,
    });

    const store = writeGiStore(gi, namespaces, externalPackages, {
        fingerprint,
        libraries: collectGeneratedLibraries(resolveBoundLibraries(libraries)),
    });

    return { namespaces: library.namespaces.size, store };
};

export { generateGiNamespace, runGiCodegen };
