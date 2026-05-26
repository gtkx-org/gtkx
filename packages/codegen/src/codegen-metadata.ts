/**
 * Codegen Metadata
 *
 * Stores codegen-only metadata produced by the FFI generator and consumed by
 * React generators. Data is not written to generated files.
 */

import type { PropertyAnalysis, SignalAnalysis } from "./generator-types.js";

/**
 * Base metadata shared between widgets and controllers.
 *
 * Contains common fields for class identification, inheritance, and prop/signal analysis.
 */
export type CodegenClassMeta = {
    /** Class name (e.g., "Button", "GestureClick") */
    readonly className: string;
    /** Namespace (e.g., "Gtk") */
    readonly namespace: string;
    /** Full JSX element name (e.g., "GtkButton", "GtkGestureClick") */
    readonly jsxName: string;
    /** Parent class name (e.g., "Window", "GestureSingle") */
    readonly parentClassName: string | null;
    /** Parent namespace for cross-namespace inheritance */
    readonly parentNamespace: string | null;
    /** All writable property names */
    readonly propNames: readonly string[];
    /** All signal names (kebab-case) */
    readonly signalNames: readonly string[];
    /** Property analysis results (for JSX types) */
    readonly properties: readonly PropertyAnalysis[];
    /** Signal analysis results (for JSX types) */
    readonly signals: readonly SignalAnalysis[];
    /** Class documentation from GIR */
    readonly doc: string | undefined;
};

/**
 * Metadata for a non-widget GObject class attached to a widget by a single
 * method (`Gtk.EventController` or `Gtk.LayoutManager`).
 *
 * Adds the `abstract` flag on top of {@link CodegenClassMeta}; abstract
 * subclasses are filtered out of the JSX surface because they cannot be
 * instantiated.
 */
export type CodegenNonWidgetClassMeta = CodegenClassMeta & {
    /** Whether this class is abstract (not instantiable) */
    readonly abstract: boolean;
};

/**
 * Controller metadata for `Gtk.EventController` subclasses.
 */
export type CodegenControllerMeta = CodegenNonWidgetClassMeta;

/**
 * Layout manager metadata for `Gtk.LayoutManager` subclasses.
 */
export type CodegenLayoutManagerMeta = CodegenNonWidgetClassMeta;

/**
 * Widget metadata - extends base with widget-specific capabilities.
 */
export type CodegenWidgetMeta = CodegenClassMeta & {
    /** Named slots for child widgets (kebab-case) */
    readonly slots: readonly string[];
    /** Container methods that accept a single widget child (kebab-case GIR names) */
    readonly containerMethods: readonly string[];
    /** Module path for imports (e.g., "./gtk/button.js") */
    readonly modulePath: string;
    /** Hidden prop names for this widget (camelCase) */
    readonly hiddenPropNames: readonly string[];
};

/**
 * Holds codegen metadata accumulated during FFI generation and consumed by React generators.
 */
export class CodegenMetadata {
    private readonly widgetMeta: CodegenWidgetMeta[] = [];
    private readonly controllerMeta: CodegenControllerMeta[] = [];
    private readonly layoutManagerMeta: CodegenLayoutManagerMeta[] = [];

    addWidgetMeta(meta: CodegenWidgetMeta): void {
        this.widgetMeta.push(meta);
    }

    addControllerMeta(meta: CodegenControllerMeta): void {
        this.controllerMeta.push(meta);
    }

    addLayoutManagerMeta(meta: CodegenLayoutManagerMeta): void {
        this.layoutManagerMeta.push(meta);
    }

    getAllWidgetMeta(): readonly CodegenWidgetMeta[] {
        return this.widgetMeta;
    }

    getAllControllerMeta(): readonly CodegenControllerMeta[] {
        return this.controllerMeta;
    }

    getAllLayoutManagerMeta(): readonly CodegenLayoutManagerMeta[] {
        return this.layoutManagerMeta;
    }
}
