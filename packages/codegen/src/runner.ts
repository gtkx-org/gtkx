import type { UserTableRows } from "@gtkx/config";
import { generateNamespaceModule } from "./ffi/pipeline.js";
import { computeFingerprint, serializeUserTables } from "./fingerprint.js";
import { type GiNamespaceInput, type GiStoreOptions, writeGiStore } from "./gi-store.js";
import { namespaceDirectory } from "./gir/namespace.js";
import { loadGirRepository } from "./gir/repository.js";
import { type JsxStoreOptions, writeJsxStore } from "./jsx-store.js";
import { generateJsxFiles } from "./react/pipeline.js";

export type CodegenRunnerOptions = {
    tables: UserTableRows;
    libraries: string[];
    girPath: string[];
    gi: GiStoreOptions;
    jsx?: JsxStoreOptions | undefined;
};

export type CodegenRunnerResult = {
    namespaces: number;
    widgets: number;
    duration: number;
};

export class CodegenRunner {
    private options: CodegenRunnerOptions;

    constructor(options: CodegenRunnerOptions) {
        this.options = options;
    }

    async run(): Promise<CodegenRunnerResult> {
        const start = Date.now();
        const repository = loadGirRepository(this.options.libraries, this.options.girPath);

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

        let widgetCount = 0;
        if (this.options.jsx !== undefined) {
            const reactPipeline = generateJsxFiles(repository, this.options.tables);
            writeJsxStore(this.options.jsx, reactPipeline.namespaces, reactPipeline.metadata);
            widgetCount = reactPipeline.widgetCount;
        }

        return {
            namespaces: repository.namespaces.size,
            widgets: widgetCount,
            duration: Date.now() - start,
        };
    }
}
