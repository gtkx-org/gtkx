/**
 * Codegen Orchestrator
 *
 * Coordinates the entire code generation pipeline:
 * 1. Loads GIR files into GirRepository
 * 2. Runs FFI generation (populates Project + Metadata)
 * 3. Runs React generation (consumes Project + Metadata)
 * 4. Emits all files at the end
 *
 * This unifies the previously separate `ffi` and `react` commands into a single
 * pipeline that shares an in-memory ts-morph Project and WeakMap-based metadata.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { GirRepository } from "@gtkx/gir";
import { FfiGenerator } from "../ffi/ffi-generator.js";
import { ReactGenerator } from "../react/react-generator.js";
import type { CodegenWidgetMeta } from "./codegen-metadata.js";
import { CodegenProject } from "./project.js";

/**
 * Options for the codegen orchestrator.
 */
export type CodegenOrchestratorOptions = {
    /** Directory containing GIR files */
    girsDir: string;
    /** Output directory for FFI bindings */
    ffiOutputDir: string;
    /** Output directory for React bindings */
    reactOutputDir: string;
};

/**
 * Result of the code generation pipeline.
 */
export type CodegenResult = {
    /** FFI files: path -> content */
    ffiFiles: Map<string, string>;
    /** React files: path -> content */
    reactFiles: Map<string, string>;
    /** Generation statistics */
    stats: CodegenStats;
};

/**
 * Statistics about the generation run.
 */
export type CodegenStats = {
    /** Number of namespaces processed */
    namespaces: number;
    /** Number of widget classes generated */
    widgets: number;
    /** Total number of files generated */
    totalFiles: number;
    /** Time taken in milliseconds */
    duration: number;
};

/**
 * Orchestrates the entire code generation pipeline.
 *
 * @example
 * ```typescript
 * const orchestrator = new CodegenOrchestrator({
 *     girsDir: "./girs",
 *     ffiOutputDir: "./packages/ffi/src/generated",
 *     reactOutputDir: "./packages/react/src/generated",
 * });
 *
 * const result = await orchestrator.generate();
 * console.log(`Generated ${result.stats.totalFiles} files`);
 * ```
 */
export class CodegenOrchestrator {
    private readonly options: CodegenOrchestratorOptions;
    private readonly project: CodegenProject;
    private readonly repository: GirRepository;

    constructor(options: CodegenOrchestratorOptions) {
        this.options = options;
        this.project = new CodegenProject();
        this.repository = new GirRepository();
    }

    /**
     * Runs the full code generation pipeline.
     */
    async generate(): Promise<CodegenResult> {
        const startTime = performance.now();

        await this.loadGirFiles();
        await this.generateFfi();
        this.generateReact();

        const { ffi: ffiFiles, react: reactFiles } = await this.project.emitGrouped();
        this.releaseAstNodes();

        const duration = performance.now() - startTime;
        const stats = this.computeStats(ffiFiles, reactFiles, duration);

        return { ffiFiles, reactFiles, stats };
    }

    /**
     * Gets the shared project instance.
     * Useful for testing or advanced use cases.
     */
    getProject(): CodegenProject {
        return this.project;
    }

    /**
     * Gets the GIR repository.
     * Useful for testing or advanced use cases.
     */
    getRepository(): GirRepository {
        return this.repository;
    }

    /**
     * Gets all widget metadata from the project.
     */
    getAllWidgetMeta(): CodegenWidgetMeta[] {
        return this.project.metadata.getAllWidgetMeta();
    }

    /**
     * Loads all GIR files from the girs directory into the repository.
     */
    private async loadGirFiles(): Promise<void> {
        const { girsDir } = this.options;
        const girFiles = await getAvailableGirFiles(girsDir);

        for (const filename of girFiles) {
            const filePath = join(girsDir, filename);
            await this.repository.loadFromFile(filePath);
        }

        this.repository.resolve();
    }

    /**
     * Generates FFI bindings for all namespaces.
     *
     * Generates bindings for every namespace loaded from GIR files.
     * Files are added to the shared project's ffi/ directory.
     */
    private async generateFfi(): Promise<void> {
        const allNamespaces = this.repository.getNamespaceNames();

        for (const namespace of allNamespaces) {
            const generator = new FfiGenerator({
                outputDir: this.options.ffiOutputDir,
                namespace,
                repository: this.repository,
                project: this.project,
                skipEmit: true,
            });

            await generator.generateNamespace(namespace);
        }
    }

    /**
     * Generates React bindings from in-memory metadata + FFI AST.
     *
     * Uses ReactGenerator which reads:
     * - CodegenWidgetMeta for properties, signals
     * - FFI AST for isContainer, slots
     * - WidgetClassifier for list/dropdown/columnview
     *
     * Files are added to the shared project's react/ directory.
     */
    private generateReact(): void {
        const widgetMeta = this.project.metadata.getAllWidgetMeta();
        if (widgetMeta.length === 0) {
            return;
        }

        const namespaceNames = [...new Set(widgetMeta.map((m) => m.namespace))];
        const generator = new ReactGenerator(widgetMeta, this.project, namespaceNames);
        generator.generate();
    }

    /**
     * Computes generation statistics.
     */
    private computeStats(
        ffiFiles: Map<string, string>,
        reactFiles: Map<string, string>,
        duration: number,
    ): CodegenStats {
        const widgetMeta = this.project.metadata.getAllWidgetMeta();

        return {
            namespaces: this.repository.getNamespaceNames().length,
            widgets: widgetMeta.length,
            totalFiles: ffiFiles.size + reactFiles.size,
            duration: Math.round(duration),
        };
    }

    /**
     * Releases AST nodes from FFI source files to reduce GC pressure.
     * Called after React generation is complete and AST is no longer needed.
     */
    private releaseAstNodes(): void {
        for (const sourceFile of this.project.getSourceFiles()) {
            sourceFile.forgetDescendants();
        }
    }
}

/**
 * Gets available GIR files in a directory.
 */
async function getAvailableGirFiles(girsDir: string): Promise<string[]> {
    const files = await readdir(girsDir);
    return files.filter((f) => f.endsWith(".gir"));
}
