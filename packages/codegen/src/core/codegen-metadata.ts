/**
 * Codegen Metadata
 *
 * WeakMap-based metadata storage for attaching codegen-only data to SourceFiles.
 * This data is used during generation but NOT written to generated files.
 *
 * The FFI generator populates metadata during generation, and React generators
 * consume it without needing to access @gtkx/gir or re-parse generated code.
 */

import type { SourceFile } from "ts-morph";
import type { PropertyAnalysis, SignalAnalysis } from "./generator-types.js";

/**
 * Codegen-only widget metadata attached to SourceFiles.
 *
 * Contains information that would be LOST after GIR parsing and cannot be
 * derived from the generated FFI AST. React generators derive other information
 * (isContainer, slots, widget classification) directly from the FFI AST.
 */
export type CodegenWidgetMeta = {
    /** Class name (e.g., "Button") */
    readonly className: string;
    /** Namespace (e.g., "Gtk") */
    readonly namespace: string;
    /** Full JSX element name (e.g., "GtkButton") */
    readonly jsxName: string;
    /** All writable property names (kebab-case) - for internal.ts PROPS map */
    readonly propNames: readonly string[];
    /** All signal names (kebab-case) */
    readonly signalNames: readonly string[];
    /** Parent class name if extends another widget (e.g., "Window") */
    readonly parentClassName: string | null;
    /** Parent namespace for cross-namespace inheritance (e.g., "Gtk" for Adw.Window extending Gtk.Window) */
    readonly parentNamespace: string | null;
    /** Module path for imports (e.g., "./gtk/button.js") */
    readonly modulePath: string;
    /** Property analysis results (for JSX types) - pre-computed from GIR */
    readonly properties: readonly PropertyAnalysis[];
    /** Signal analysis results (for JSX types) - pre-computed from GIR */
    readonly signals: readonly SignalAnalysis[];
    /** Constructor parameter names (camelCase) - for internal.ts CONSTRUCTOR_PROPS */
    readonly constructorParams: readonly string[];
};

/**
 * Manages codegen-only metadata attached to SourceFiles.
 *
 * Metadata is populated by FfiGenerator and consumed by React generators.
 * Since codegen is a short-lived process, we use a simple Map for storage.
 *
 * @example
 * ```typescript
 * const metadata = new CodegenMetadata();
 *
 * // FFI generator attaches metadata
 * metadata.setWidgetMeta(buttonSourceFile, {
 *     className: "Button",
 *     namespace: "Gtk",
 *     jsxName: "GtkButton",
 *     propNames: ["label", "icon-name"],
 *     signalNames: ["clicked"],
 *     parentClassName: "Widget",
 *     modulePath: "./gtk/button.js",
 *     properties: [...],
 *     signals: [...],
 * });
 *
 * // React generator reads metadata (no GIR or AST parsing needed)
 * // isContainer/slots are derived from FFI AST, not stored in metadata
 * const meta = metadata.getWidgetMeta(buttonSourceFile);
 * ```
 */
export class CodegenMetadata {
    private readonly widgetMeta = new Map<SourceFile, CodegenWidgetMeta>();

    /**
     * Attaches widget metadata to a SourceFile.
     */
    setWidgetMeta(sourceFile: SourceFile, meta: CodegenWidgetMeta): void {
        this.widgetMeta.set(sourceFile, meta);
    }

    /**
     * Gets widget metadata for a SourceFile.
     */
    getWidgetMeta(sourceFile: SourceFile): CodegenWidgetMeta | null {
        return this.widgetMeta.get(sourceFile) ?? null;
    }

    /**
     * Gets all widget metadata.
     */
    getAllWidgetMeta(): CodegenWidgetMeta[] {
        return Array.from(this.widgetMeta.values());
    }

    /**
     * Clears all metadata.
     */
    clear(): void {
        this.widgetMeta.clear();
    }
}
