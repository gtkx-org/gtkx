/**
 * Metadata Reader
 *
 * Reads widget data from CodegenWidgetMeta.
 * Provides access to all widget metadata computed during FFI generation.
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
 * Widget info from metadata.
 * Uses Pick<> to derive from CodegenWidgetMeta for DRY compliance.
 */
export type WidgetInfo = Pick<
    CodegenWidgetMeta,
    | "className"
    | "jsxName"
    | "namespace"
    | "isContainer"
    | "slots"
    | "propNames"
    | "signalNames"
    | "parentClassName"
    | "modulePath"
    | "constructorParams"
>;

export class MetadataReader {
    private readonly widgetsByJsxName = new Map<string, WidgetInfo>();
    private readonly widgetsByNamespaceClass = new Map<string, WidgetInfo>();

    constructor(private readonly allMeta: readonly CodegenWidgetMeta[]) {
        for (const meta of allMeta) {
            const widgetInfo = this.toWidgetInfo(meta);
            this.widgetsByJsxName.set(meta.jsxName, widgetInfo);
            this.widgetsByNamespaceClass.set(`${meta.namespace}.${meta.className}`, widgetInfo);
        }
    }

    getAllWidgets(): WidgetInfo[] {
        return Array.from(this.widgetsByJsxName.values());
    }

    getWidget(jsxName: string): WidgetInfo | null {
        return this.widgetsByJsxName.get(jsxName) ?? null;
    }

    getWidgetByNamespaceClass(namespace: string, className: string): WidgetInfo | null {
        return this.widgetsByNamespaceClass.get(`${namespace}.${className}`) ?? null;
    }

    getWidgetsSorted(): WidgetInfo[] {
        return sortWidgetsByClassName(this.getAllWidgets());
    }

    getPropNames(jsxName: string): readonly string[] {
        return this.getWidget(jsxName)?.propNames ?? [];
    }

    getAllCodegenMeta(): readonly CodegenWidgetMeta[] {
        return this.allMeta;
    }

    private toWidgetInfo(meta: CodegenWidgetMeta): WidgetInfo {
        const { properties: _, signals: __, parentNamespace: ___, ...widgetInfo } = meta;
        return widgetInfo;
    }
}
