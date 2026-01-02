/**
 * React Generator
 *
 * Unified React/JSX generator that reads from:
 * - CodegenWidgetMeta: properties, signals, prop names (from FFI generation)
 * - FFI AST: isContainer, slots (derived from WIDGET_META constant)
 * - Shared constants: widget classification (LIST_WIDGET_NAMES, etc.)
 *
 * Flow:
 * 1. FFI codegen → produces CodegenWidgetMeta[] + FFI files in shared Project
 * 2. Generate internal.ts (classification constants + metadata) into shared Project
 * 3. Generate jsx.ts (uses shared classification constants + FFI AST) into shared Project
 * 4. Generate registry.ts into shared Project
 */

import type { CodegenWidgetMeta } from "../core/codegen-metadata.js";
import type { CodegenProject } from "../core/project.js";
import { FfiAstAnalyzer } from "./analyzers/index.js";
import { InternalGenerator } from "./generators/internal.js";
import { JsxTypesGenerator } from "./generators/jsx-types/index.js";
import { RegistryGenerator } from "./generators/registry.js";
import { MetadataReader } from "./metadata-reader.js";

/**
 * Unified React/JSX generator.
 *
 * Generates React bindings directly into the shared CodegenProject.
 * Files are added to the project's `react/` directory.
 *
 * @example
 * ```typescript
 * // After FFI generation (orchestrator mode)
 * const widgetMeta = project.metadata.getAllWidgetMeta();
 *
 * // Generate React/JSX into shared project
 * const generator = new ReactGenerator(widgetMeta, project, ["Gtk", "Adw"]);
 * generator.generate();
 *
 * // All files (FFI + React) are now in the project
 * const { ffi, react } = await project.emitGrouped();
 * ```
 */
export class ReactGenerator {
    private readonly reader: MetadataReader;
    private readonly ffiAnalyzer: FfiAstAnalyzer;

    constructor(
        widgetMeta: readonly CodegenWidgetMeta[],
        private readonly project: CodegenProject,
        private readonly namespaceNames: string[],
    ) {
        this.reader = new MetadataReader(widgetMeta);
        this.ffiAnalyzer = new FfiAstAnalyzer(project.getProject());
    }

    /**
     * Generates all React output files into the shared project.
     */
    generate(): void {
        const internalGenerator = new InternalGenerator(this.reader, this.project);
        internalGenerator.generate();

        const jsxTypesGenerator = new JsxTypesGenerator(
            this.reader,
            this.ffiAnalyzer,
            this.project,
            this.namespaceNames,
        );
        jsxTypesGenerator.generate();

        const registryGenerator = new RegistryGenerator(this.project, this.namespaceNames);
        registryGenerator.generate();
    }
}
