import type { ElementProp } from "@gtkx/config";
import { computeFingerprint } from "./fingerprint.js";
import { Library } from "./gir/library.js";
import { namespaceDirectory } from "./gir/namespace.js";
import { generateNamespaceModule } from "./store/gi/pipeline.js";
import { type GiNamespaceInput, type GiStoreOptions, writeGiStore } from "./store/gi-store.js";
import { type JsxStoreOptions, writeJsxStore } from "./store/jsx-store.js";
import { generateJsxFiles } from "./store/react/pipeline.js";

type CodegenRunnerOptions = {
    libraries: string[];
    girPath: string[];
    elementProps?: Record<string, ElementProp[]> | undefined;
    gi: GiStoreOptions;
    jsx?: JsxStoreOptions | undefined;
};

type CodegenRunnerResult = {
    namespaces: number;
    intrinsicElements: number;
    duration: number;
};

export const runCodegen = async (options: CodegenRunnerOptions): Promise<CodegenRunnerResult> => {
    const start = Date.now();
    const library = loadLibrary(options);
    emitGiStore(options, library);
    const intrinsicElements = emitJsxStore(options, library);

    return {
        namespaces: library.namespaces.size,
        intrinsicElements,
        duration: Date.now() - start,
    };
};

const loadLibrary = (options: CodegenRunnerOptions): Library => Library.load(options.libraries, options.girPath);

const emitGiStore = (options: CodegenRunnerOptions, library: Library): void => {
    const namespaces: GiNamespaceInput[] = [];
    for (const namespace of library.namespaces.values()) {
        namespaces.push({
            directory: namespaceDirectory(namespace),
            rawSource: generateNamespaceModule(namespace, library),
        });
    }
    const libraries = [...options.libraries];
    writeGiStore(options.gi, namespaces, {
        value: computeFingerprint(library.girFiles, libraries, options.elementProps ?? {}),
        girFiles: library.girFiles,
        libraries,
    });
};

const emitJsxStore = (options: CodegenRunnerOptions, library: Library): number => {
    if (options.jsx === undefined) return 0;
    const reactPipeline = generateJsxFiles(library, options.elementProps);
    writeJsxStore(options.jsx, reactPipeline.namespaces, reactPipeline.metadata);
    return reactPipeline.intrinsicElementCount;
};
