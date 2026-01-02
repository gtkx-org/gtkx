/**
 * Metadata Reader
 *
 * Reads widget data from CodegenWidgetMeta.
 * Provides access to property/signal analysis that was pre-computed during FFI generation.
 *
 * Note: Widget classification (isContainer, slots, isListWidget, etc.) is NOT provided here.
 * Those values are derived from the FFI AST by the JSX generators.
 */

import type { CodegenWidgetMeta } from "../core/codegen-metadata.js";

const WIDGET_PRIORITY: Record<string, number> = {
    Widget: 0,
    Window: 1,
};

function compareWidgetsByClassName(a: { className: string }, b: { className: string }): number {
    const aPriority = WIDGET_PRIORITY[a.className];
    const bPriority = WIDGET_PRIORITY[b.className];

    if (aPriority !== undefined && bPriority !== undefined) {
        return aPriority - bPriority;
    }

    if (aPriority !== undefined) return -1;
    if (bPriority !== undefined) return 1;

    return a.className.localeCompare(b.className);
}

export function sortWidgetsByClassName<T extends { className: string }>(widgets: readonly T[]): T[] {
    return [...widgets].sort(compareWidgetsByClassName);
}

/**
 * Simplified widget info from metadata.
 * Does NOT include derived fields (isContainer, slots) or analysis results (properties, signals).
 * Uses Pick<> to derive from CodegenWidgetMeta for DRY compliance.
 */
export type WidgetInfo = Pick<
    CodegenWidgetMeta,
    | "className"
    | "jsxName"
    | "namespace"
    | "propNames"
    | "signalNames"
    | "parentClassName"
    | "modulePath"
    | "constructorParams"
>;

/**
 * Reads widget data from CodegenWidgetMeta.
 *
 * This provides access to metadata that was pre-computed during FFI generation
 * (properties, signals, etc.). Widget classification (isContainer, slots)
 * is derived from the FFI AST by JSX generators.
 *
 * @example
 * ```typescript
 * const reader = new MetadataReader(widgetMetaArray);
 *
 * // Get all widgets
 * const widgets = reader.getAllWidgets();
 * const sortedWidgets = reader.getWidgetsSorted();
 * ```
 */
export class MetadataReader {
    private readonly widgetsByJsxName = new Map<string, WidgetInfo>();

    constructor(private readonly allMeta: readonly CodegenWidgetMeta[]) {
        for (const meta of allMeta) {
            const widgetInfo = this.toWidgetInfo(meta);
            this.widgetsByJsxName.set(meta.jsxName, widgetInfo);
        }
    }

    /**
     * Gets all widgets.
     */
    getAllWidgets(): WidgetInfo[] {
        return Array.from(this.widgetsByJsxName.values());
    }

    /**
     * Gets a specific widget by JSX name (e.g., "GtkButton", "AdwHeaderBar").
     */
    getWidget(jsxName: string): WidgetInfo | null {
        return this.widgetsByJsxName.get(jsxName) ?? null;
    }

    /**
     * Gets all widgets sorted for JSX generation.
     * Widget first, then Window, then alphabetically.
     */
    getWidgetsSorted(): WidgetInfo[] {
        return sortWidgetsByClassName(this.getAllWidgets());
    }

    /**
     * Gets prop names for a widget by JSX name.
     */
    getPropNames(jsxName: string): readonly string[] {
        return this.getWidget(jsxName)?.propNames ?? [];
    }

    /**
     * Gets all CodegenWidgetMeta.
     */
    getAllCodegenMeta(): readonly CodegenWidgetMeta[] {
        return this.allMeta;
    }

    private toWidgetInfo(meta: CodegenWidgetMeta): WidgetInfo {
        const { properties: _, signals: __, parentNamespace: ___, ...widgetInfo } = meta;
        return widgetInfo;
    }
}
