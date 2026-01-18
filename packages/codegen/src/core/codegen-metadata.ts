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
import type { WidgetClassificationType } from "./config/index.js";
import type { PropertyAnalysis, SignalAnalysis } from "./generator-types.js";

/**
 * Codegen-only widget metadata attached to SourceFiles.
 *
 * All widget metadata is computed once during FFI generation and passed
 * to React generators via this structure. Nothing is written to output files.
 */
export type CodegenWidgetMeta = {
    /** Class name (e.g., "Button") */
    readonly className: string;
    /** Namespace (e.g., "Gtk") */
    readonly namespace: string;
    /** Full JSX element name (e.g., "GtkButton") */
    readonly jsxName: string;
    /** Widget can contain children */
    readonly isContainer: boolean;
    /** Widget supports an Adjustment child */
    readonly isAdjustable: boolean;
    /** Widget has a buffer (TextView, SourceView) */
    readonly hasBuffer: boolean;
    /** Widget supports marks (Scale, Calendar) */
    readonly hasMarks: boolean;
    /** Widget supports offsets (LevelBar) */
    readonly hasOffsets: boolean;
    /** Named slots for child widgets (kebab-case) */
    readonly slots: readonly string[];
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
    /** Class documentation from GIR */
    readonly doc: string | undefined;
    /** Pre-computed widget classification for React */
    readonly classification: WidgetClassificationType | null;
    /** Hidden prop names for this widget (camelCase) */
    readonly hiddenPropNames: readonly string[];
};

/**
 * Manages codegen-only metadata attached to SourceFiles.
 *
 * Metadata is populated by FfiGenerator and consumed by React generators.
 * Since codegen is a short-lived process, we use a simple Map for storage.
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
