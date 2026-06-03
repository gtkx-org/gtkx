import { generateNamespaceModule } from "./ffi/pipeline.js";
import { computeFingerprint } from "./fingerprint.js";
import { type GiNamespaceInput, type GiStoreOptions, writeGiStore } from "./gi-store.js";
import { loadGirRepository } from "./gir/repository.js";
import { type JsxStoreOptions, writeJsxStore } from "./jsx-store.js";
import { generateReactFiles } from "./react/pipeline.js";

/**
 * Options for {@link CodegenRunner}.
 */
export type CodegenRunnerOptions = {
    /** Resolved `Name-Version` namespace identifiers to generate. */
    readonly libraries: readonly string[];
    /** Directories searched for `.gir` files. */
    readonly girPath: readonly string[];
    /** Optional user widget-slot overrides keyed by JSX element name (setter semantics). */
    readonly widgetSlots?: Readonly<Record<string, readonly string[]>>;
    /** Optional user container-slot overrides keyed by JSX element name (append semantics). */
    readonly containerSlots?: Readonly<Record<string, readonly string[]>>;
    /** Target for the injected `@gtkx/gi` bindings package. */
    readonly gi: GiStoreOptions;
    /** Target for the injected `@gtkx/react-jsx` unit; React is skipped when omitted. */
    readonly jsx?: JsxStoreOptions;
};

/**
 * Result returned from {@link CodegenRunner.run}.
 */
export type CodegenRunnerResult = {
    /** Number of FFI namespaces produced. */
    readonly namespaces: number;
    /** Number of widget intrinsics emitted into `jsx.ts`. */
    readonly widgets: number;
    /** Wall-clock duration in milliseconds. */
    readonly duration: number;
};

/**
 * Single-entry orchestrator for the GTKX codegen.
 *
 * Loads the GIR repository, runs the FFI pipeline per namespace, runs the
 * React pipeline once, and materializes the self-contained `@gtkx/gi` (and
 * optional `@gtkx/react-jsx`) packages into the project's `node_modules`.
 *
 * @example
 * ```ts
 * import { CodegenRunner } from "@gtkx/codegen";
 *
 * await new CodegenRunner({
 *     libraries: ["Gtk-4.0", "Adw-1"],
 *     girPath: ["/usr/share/gir-1.0"],
 *     gi: { storeDir, linkDir, realFfiDir, realNativeDir, version },
 * }).run();
 * ```
 */
export class CodegenRunner {
    constructor(private readonly options: CodegenRunnerOptions) {}

    /**
     * Executes the full codegen pipeline and materializes the output packages.
     */
    async run(): Promise<CodegenRunnerResult> {
        const start = Date.now();
        const repository = loadGirRepository(this.options.libraries, this.options.girPath);

        const namespaces: GiNamespaceInput[] = [];
        for (const namespace of repository.namespaces.values()) {
            const { source } = generateNamespaceModule(namespace, repository);
            namespaces.push({ directory: namespace.name.toLowerCase(), rawSource: source });
        }
        const libraries = [...this.options.libraries];
        writeGiStore(this.options.gi, namespaces, {
            value: computeFingerprint(repository.girFiles, libraries),
            girFiles: repository.girFiles,
            libraries,
        });

        let widgetCount = 0;
        if (this.options.jsx !== undefined) {
            const reactPipeline = generateReactFiles(repository, {
                widgetSlots: this.options.widgetSlots,
                containerSlots: this.options.containerSlots,
            });
            writeJsxStore(this.options.jsx, reactPipeline.files);
            widgetCount = reactPipeline.widgetCount;
        }

        return {
            namespaces: repository.namespaces.size,
            widgets: widgetCount,
            duration: Date.now() - start,
        };
    }
}
