import type { ArrayPropRow, ElementMapRule, ObjectPropRow, VirtualPropRow } from "@gtkx/config";
import { mergeBigIntAliases } from "./bigint-aliases.js";
import { generateNamespaceModule } from "./ffi/pipeline.js";
import { computeFingerprint, serializeUserTables } from "./fingerprint.js";
import { type GiNamespaceInput, type GiStoreOptions, writeGiStore } from "./gi-store.js";
import { loadGirRepository } from "./gir/repository.js";
import { type JsxStoreOptions, writeJsxStore } from "./jsx-store.js";
import { generateJsxFiles } from "./react/pipeline.js";

/**
 * Options for {@link CodegenRunner}.
 */
export type CodegenRunnerOptions = {
    /** Resolved `Name-Version` namespace identifiers to generate. */
    readonly libraries: readonly string[];
    /** Directories searched for `.gir` files. */
    readonly girPath: readonly string[];
    /** Optional user widget-slot overrides keyed by JSX element name (setter semantics). */
    readonly slots?: Readonly<Record<string, readonly string[]>>;
    /** Optional user container-slot overrides keyed by JSX element name (append semantics). */
    readonly containerSlots?: Readonly<Record<string, readonly string[]>>;
    /** Optional user array-prop rows keyed by JSX element name then prop name. */
    readonly arrayProps?: Readonly<Record<string, Readonly<Record<string, ArrayPropRow>>>>;
    /** Optional user object-prop rows keyed by JSX element name then prop name. */
    readonly objectProps?: Readonly<Record<string, Readonly<Record<string, ObjectPropRow>>>>;
    /** Optional user virtual-prop rows keyed by JSX element name then prop name. */
    readonly virtualProps?: Readonly<Record<string, Readonly<Record<string, VirtualPropRow>>>>;
    /** Optional user attach rules merged after the built-in element-map rows. */
    readonly elementMap?: readonly ElementMapRule[];
    /** Optional qualified `Namespace.Alias` names surfaced as `bigint`, merged with the built-ins. */
    readonly bigintAliases?: readonly string[];
    /** Target for the injected `@gtkx/gi` bindings package. */
    readonly gi: GiStoreOptions;
    /** Target for the injected `@gtkx/jsx` package; React is skipped when omitted. */
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
 * optional `@gtkx/jsx`) packages into the project's `node_modules`.
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
        const bigintAliases = mergeBigIntAliases(this.options.bigintAliases);

        const namespaces: GiNamespaceInput[] = [];
        for (const namespace of repository.namespaces.values()) {
            const { source } = generateNamespaceModule(namespace, repository, bigintAliases);
            namespaces.push({ directory: namespace.name.toLowerCase(), rawSource: source });
        }
        const libraries = [...this.options.libraries];
        const tables = {
            slots: this.options.slots,
            containerSlots: this.options.containerSlots,
            arrayProps: this.options.arrayProps,
            objectProps: this.options.objectProps,
            virtualProps: this.options.virtualProps,
            elementMap: this.options.elementMap,
            bigintAliases: this.options.bigintAliases,
        };
        writeGiStore(this.options.gi, namespaces, {
            value: computeFingerprint(repository.girFiles, libraries, serializeUserTables(tables)),
            girFiles: repository.girFiles,
            libraries,
        });

        let widgetCount = 0;
        if (this.options.jsx !== undefined) {
            const reactPipeline = generateJsxFiles(repository, { ...tables, bigintAliases });
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
