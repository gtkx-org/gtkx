import { generateNamespaceModule } from "./ffi/pipeline.js";
import { computeFingerprint } from "./fingerprint.js";
import { type GiNamespaceInput, type GiStoreOptions, writeGiStore } from "./gi-store.js";
import { namespaceDirectory } from "./gir/namespace.js";
import { Library } from "./gir/library.js";
import { type JsxStoreOptions, writeJsxStore } from "./jsx-store.js";
import { generateJsxFiles } from "./react/pipeline.js";

export type CodegenRunnerOptions = {
    libraries: string[];
    girPath: string[];
    gi: GiStoreOptions;
    jsx?: JsxStoreOptions | undefined;
};

export type CodegenRunnerResult = {
    namespaces: number;
    reactNodes: number;
    duration: number;
};

export class CodegenRunner {
    private options: CodegenRunnerOptions;

    constructor(options: CodegenRunnerOptions) {
        this.options = options;
    }

    async run(): Promise<CodegenRunnerResult> {
        const start = Date.now();
        const library = this.loadRepository();
        this.emitFfiStore(library);
        const reactNodes = this.emitJsxStore(library);

        return {
            namespaces: library.namespaces.size,
            reactNodes,
            duration: Date.now() - start,
        };
    }

    private loadRepository(): Library {
        return Library.load(this.options.libraries, this.options.girPath);
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
