import { generateNamespaceModule } from "./ffi/pipeline.js";
import { computeFingerprint } from "./fingerprint.js";
import { type GiNamespaceInput, type GiStoreOptions, writeGiStore } from "./gi-store.js";
import { namespaceDirectory } from "./gir/namespace.js";
import { type Library, loadLibrary } from "./gir/repository.js";
import { type JsxStoreOptions, writeJsxStore } from "./jsx-store.js";
import { generateJsxFiles } from "./react/pipeline.js";

export type CodegenRunnerOptions = {
    libraries: string[];
    girPath: string[];
    gi: GiStoreOptions;
    jsx?: JsxStoreOptions | undefined;
};

export type CodegenPhaseTimings = {
    loadRepository: number;
    emitFfiStore: number;
    emitJsxStore: number;
};

export type CodegenRunnerResult = {
    namespaces: number;
    reactNodes: number;
    duration: number;
    phases: CodegenPhaseTimings;
};

const timed = <T>(work: () => T): { value: T; duration: number } => {
    const start = Date.now();
    const value = work();
    return { value, duration: Date.now() - start };
};

export class CodegenRunner {
    private options: CodegenRunnerOptions;

    constructor(options: CodegenRunnerOptions) {
        this.options = options;
    }

    async run(): Promise<CodegenRunnerResult> {
        const start = Date.now();
        const load = timed(() => this.loadRepository());
        const library = load.value;
        const ffi = timed(() => this.emitFfiStore(library));
        const jsx = timed(() => this.emitJsxStore(library));

        return {
            namespaces: library.namespaces.size,
            reactNodes: jsx.value,
            duration: Date.now() - start,
            phases: {
                loadRepository: load.duration,
                emitFfiStore: ffi.duration,
                emitJsxStore: jsx.duration,
            },
        };
    }

    private loadRepository(): Library {
        return loadLibrary(this.options.libraries, this.options.girPath);
    }

    private emitFfiStore(library: Library): void {
        const namespaces: GiNamespaceInput[] = [];
        for (const namespace of library.namespaces.values()) {
            const { source } = generateNamespaceModule(namespace, library);
            namespaces.push({ directory: namespaceDirectory(namespace), rawSource: source });
        }
        const libraries = [...this.options.libraries];
        writeGiStore(this.options.gi, namespaces, {
            value: computeFingerprint(library.girFiles, libraries),
            girFiles: library.girFiles,
            libraries,
        });
    }

    private emitJsxStore(library: Library): number {
        if (this.options.jsx === undefined) return 0;
        const reactPipeline = generateJsxFiles(library);
        writeJsxStore(this.options.jsx, reactPipeline.namespaces, reactPipeline.metadata);
        return reactPipeline.reactNodeCount;
    }
}
