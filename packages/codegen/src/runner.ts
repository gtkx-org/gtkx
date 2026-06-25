import { generateNamespaceModule } from "./ffi/pipeline.js";
import { computeFingerprint } from "./fingerprint.js";
import { Library } from "./gir/library.js";
import { namespaceDirectory } from "./gir/namespace.js";
import { generateJsxFiles } from "./react/pipeline.js";
import { type GiNamespaceInput, type GiStoreOptions, writeGiStore } from "./store/gi-store.js";
import { type JsxStoreOptions, writeJsxStore } from "./store/jsx-store.js";

type CodegenRunnerOptions = {
    libraries: string[];
    girPath: string[];
    gi: GiStoreOptions;
    jsx?: JsxStoreOptions | undefined;
};

export type CodegenRunnerResult = {
    namespaces: number;
    intrinsicElements: number;
    duration: number;
};

export const runCodegen = async (options: CodegenRunnerOptions): Promise<CodegenRunnerResult> => {
    const start = Date.now();
    const library = loadLibrary(options);
    emitFfiStore(options, library);
    const intrinsicElements = emitJsxStore(options, library);

    return {
        namespaces: library.namespaces.size,
        intrinsicElements,
        duration: Date.now() - start,
    };
};

const loadLibrary = (options: CodegenRunnerOptions): Library => Library.load(options.libraries, options.girPath);

const emitFfiStore = (options: CodegenRunnerOptions, library: Library): void => {
    const namespaces: GiNamespaceInput[] = [];
    for (const namespace of library.namespaces.values()) {
        const { source } = generateNamespaceModule(namespace, library);
        namespaces.push({ directory: namespaceDirectory(namespace), rawSource: source });
    }
    const libraries = [...options.libraries];
    writeGiStore(options.gi, namespaces, {
        value: computeFingerprint(library.girFiles, libraries),
        girFiles: library.girFiles,
        libraries,
    });
};

const emitJsxStore = (options: CodegenRunnerOptions, library: Library): number => {
    if (options.jsx === undefined) return 0;
    const reactPipeline = generateJsxFiles(library);
    writeJsxStore(options.jsx, reactPipeline.namespaces, reactPipeline.metadata);
    return reactPipeline.intrinsicElementCount;
};
