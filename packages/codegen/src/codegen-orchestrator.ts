import { CodegenMetadata } from "./codegen-metadata.js";
import { RenderableSlotsRegistry, type SlotPropsOverrides } from "./config/index.js";
import { FfiGenerator } from "./ffi/ffi-generator.js";
import type { GeneratedFile } from "./generated-file-set.js";
import type { GirRepository } from "./gir/index.js";
import { ReactGenerator } from "./react/react-generator.js";

/**
 * Configuration for {@link CodegenOrchestrator}.
 */
type CodegenOrchestratorOptions = {
    /** The resolved GIR repository to generate bindings from. */
    repository: GirRepository;
    /**
     * Optional user-supplied renderable slot overrides, keyed by JSX
     * element name. Merges with the built-in renderable-slot map so
     * consumer-provided widget types can opt their widget-typed properties
     * into the JSX child-slot pipeline.
     */
    slotProps?: SlotPropsOverrides;
};

type CodegenResult = {
    ffiFiles: Map<string, string>;
    reactFiles: Map<string, string>;
    stats: CodegenStats;
};

type CodegenStats = {
    namespaces: number;
    widgets: number;
    totalFiles: number;
    duration: number;
};

/**
 * Drives FFI and React binding generation from a resolved {@link GirRepository}.
 */
export class CodegenOrchestrator {
    private readonly repository: GirRepository;
    private readonly renderableSlots: RenderableSlotsRegistry;
    private readonly metadata = new CodegenMetadata();
    private readonly ffiGeneratedFiles: GeneratedFile[] = [];
    private readonly reactGeneratedFiles: GeneratedFile[] = [];

    constructor(options: CodegenOrchestratorOptions) {
        this.repository = options.repository;
        this.renderableSlots = new RenderableSlotsRegistry(options.slotProps);
    }

    generate(): CodegenResult {
        const startTime = performance.now();

        this.generateFfi();
        this.generateReact();

        const ffiFiles = new Map<string, string>();
        for (const file of this.ffiGeneratedFiles) {
            ffiFiles.set(file.path, file.content);
        }

        const reactFiles = new Map<string, string>();
        for (const file of this.reactGeneratedFiles) {
            reactFiles.set(file.path, file.content);
        }

        const duration = performance.now() - startTime;
        const stats = this.computeStats(ffiFiles, reactFiles, duration);

        return { ffiFiles, reactFiles, stats };
    }

    private generateFfi(): void {
        const allNamespaces = this.repository.getNamespaceNames();

        for (const namespace of allNamespaces) {
            const generator = new FfiGenerator({
                namespace,
                repository: this.repository,
            });

            const result = generator.generateNamespace(namespace);
            this.ffiGeneratedFiles.push(...result.files);

            for (const meta of result.metadata.getAllWidgetMeta()) {
                this.metadata.addWidgetMeta(meta);
            }
            for (const meta of result.metadata.getAllControllerMeta()) {
                this.metadata.addControllerMeta(meta);
            }
        }
    }

    private generateReact(): void {
        const widgetMeta = this.metadata.getAllWidgetMeta();
        if (widgetMeta.length === 0) {
            return;
        }

        const controllerMeta = this.metadata.getAllControllerMeta();
        const namespaceNames = [...new Set(widgetMeta.map((m) => m.namespace))];
        const generator = new ReactGenerator(widgetMeta, controllerMeta, namespaceNames, this.renderableSlots);
        this.reactGeneratedFiles.push(...generator.generate());
    }

    private computeStats(
        ffiFiles: Map<string, string>,
        reactFiles: Map<string, string>,
        duration: number,
    ): CodegenStats {
        const widgetMeta = this.metadata.getAllWidgetMeta();

        return {
            namespaces: this.repository.getNamespaceNames().length,
            widgets: widgetMeta.length,
            totalFiles: ffiFiles.size + reactFiles.size,
            duration: Math.round(duration),
        };
    }
}
