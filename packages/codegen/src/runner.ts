import type { UserTableRows } from "@gtkx/config";
import { generateNamespaceModule } from "./ffi/pipeline.js";
import { computeFingerprint, serializeUserTables } from "./fingerprint.js";
import { type GiNamespaceInput, type GiStoreOptions, writeGiStore } from "./gi-store.js";
import { namespaceDirectory } from "./gir/namespace.js";
import { type GirRepository, loadGirRepository } from "./gir/repository.js";
import { type JsxStoreOptions, writeJsxStore } from "./jsx-store.js";
import { generateJsxFiles } from "./react/pipeline.js";

export type CodegenRunnerOptions = {
    tables: UserTableRows;
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
    widgets: number;
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
        const repository = load.value;
        const ffi = timed(() => this.emitFfiStore(repository));
        const jsx = timed(() => this.emitJsxStore(repository));

        return {
            namespaces: repository.namespaces.size,
            widgets: jsx.value,
            duration: Date.now() - start,
            phases: {
                loadRepository: load.duration,
                emitFfiStore: ffi.duration,
                emitJsxStore: jsx.duration,
            },
        };
    }

    private loadRepository(): GirRepository {
        return loadGirRepository(this.options.libraries, this.options.girPath);
    }

    private emitFfiStore(repository: GirRepository): void {
        const namespaces: GiNamespaceInput[] = [];
        for (const namespace of repository.namespaces.values()) {
            const { source } = generateNamespaceModule(namespace, repository);
            namespaces.push({ directory: namespaceDirectory(namespace), rawSource: source });
        }
        const libraries = [...this.options.libraries];
        writeGiStore(this.options.gi, namespaces, {
            value: computeFingerprint(repository.girFiles, libraries, serializeUserTables(this.options.tables)),
            girFiles: repository.girFiles,
            libraries,
        });
    }

    private emitJsxStore(repository: GirRepository): number {
        if (this.options.jsx === undefined) return 0;
        const reactPipeline = generateJsxFiles(repository, this.options.tables);
        writeJsxStore(this.options.jsx, reactPipeline.namespaces, reactPipeline.metadata);
        return reactPipeline.widgetCount;
    }
}
