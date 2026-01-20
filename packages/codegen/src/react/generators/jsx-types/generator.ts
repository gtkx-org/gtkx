/**
 * JSX Types Generator
 *
 * Generates JSX type definitions from:
 * - CodegenWidgetMeta: properties, signals, prop names, isContainer, slots (from FFI generation)
 * - Internal constants: list/dropdown/columnview classification
 */

import type { SourceFile } from "ts-morph";
import type { CodegenWidgetMeta } from "../../../core/codegen-metadata.js";
import {
    COLUMN_VIEW_WIDGET_NAMES,
    DRAWING_AREA_WIDGET_NAMES,
    DROP_DOWN_WIDGET_NAMES,
    LIST_WIDGET_NAMES,
    NAVIGATION_VIEW_WIDGET_NAMES,
    NOTEBOOK_WIDGET_NAMES,
    SCROLLED_WINDOW_WIDGET_NAMES,
    STACK_WIDGET_NAMES,
    WINDOW_WIDGET_NAMES,
} from "../../../core/config/index.js";
import type { CodegenProject } from "../../../core/project.js";
import { toCamelCase } from "../../../core/utils/naming.js";
import { addNamespaceImports } from "../../../core/utils/structure-helpers.js";
import { type MetadataReader, sortWidgetsByClassName } from "../../metadata-reader.js";
import { IntrinsicElementsBuilder } from "./intrinsic-elements-builder.js";
import { WidgetPropsBuilder } from "./widget-props-builder.js";

export type JsxWidget = {
    className: string;
    jsxName: string;
    namespace: string;
    isListWidget: boolean;
    isDropDownWidget: boolean;
    isColumnViewWidget: boolean;
    isNavigationView: boolean;
    isStack: boolean;
    isNotebook: boolean;
    isWindow: boolean;
    isScrolledWindow: boolean;
    isDrawingArea: boolean;
    isContainer: boolean;
    isAdjustable: boolean;
    hasBuffer: boolean;
    hasMarks: boolean;
    hasOffsets: boolean;
    hasColorDialog: boolean;
    hasFontDialog: boolean;
    slots: readonly string[];
    hiddenProps: Set<string>;
    meta: CodegenWidgetMeta;
};

export class JsxTypesGenerator {
    private readonly propsBuilder = new WidgetPropsBuilder();
    private readonly intrinsicBuilder = new IntrinsicElementsBuilder();

    constructor(
        private readonly reader: MetadataReader,
        private readonly project: CodegenProject,
        private readonly namespaceNames: string[],
    ) {}

    generate(): void {
        const sourceFile = this.project.createReactSourceFile("jsx.ts");

        const widgets = this.getWidgets();
        this.propsBuilder.clearUsedNamespaces();

        this.generateWidgetNotifyProps(sourceFile, widgets);
        this.generateBaseWidgetProps(sourceFile, widgets);
        this.generateWidgetPropsInterfaces(sourceFile, widgets);
        this.addImports(sourceFile, widgets);

        this.intrinsicBuilder.buildWidgetSlotNamesType(sourceFile, widgets);
        this.intrinsicBuilder.buildWidgetExports(sourceFile, widgets);
        this.intrinsicBuilder.buildJsxNamespace(sourceFile, widgets);
        this.intrinsicBuilder.addModuleExport(sourceFile);
    }

    private getWidgets(): JsxWidget[] {
        const allMeta = this.reader.getAllCodegenMeta();

        const filtered = allMeta.filter((m) => this.namespaceNames.includes(m.namespace));
        const widgets = filtered.map((meta) => this.toJsxWidget(meta));

        return sortWidgetsByClassName(widgets);
    }

    private toJsxWidget(meta: CodegenWidgetMeta): JsxWidget {
        const hiddenProps = new Set(meta.hiddenPropNames);
        const filteredSlots = meta.slots.filter((slot) => !hiddenProps.has(toCamelCase(slot)));

        return {
            className: meta.className,
            jsxName: meta.jsxName,
            namespace: meta.namespace,
            isListWidget: LIST_WIDGET_NAMES.has(meta.className),
            isDropDownWidget: DROP_DOWN_WIDGET_NAMES.has(meta.className),
            isColumnViewWidget: COLUMN_VIEW_WIDGET_NAMES.has(meta.className),
            isNavigationView: NAVIGATION_VIEW_WIDGET_NAMES.has(meta.className),
            isStack: STACK_WIDGET_NAMES.has(meta.className),
            isNotebook: NOTEBOOK_WIDGET_NAMES.has(meta.className),
            isWindow: WINDOW_WIDGET_NAMES.has(meta.className),
            isScrolledWindow: SCROLLED_WINDOW_WIDGET_NAMES.has(meta.className),
            isDrawingArea: DRAWING_AREA_WIDGET_NAMES.has(meta.className),
            isContainer: meta.isContainer,
            isAdjustable: meta.isAdjustable,
            hasBuffer: meta.hasBuffer,
            hasMarks: meta.hasMarks,
            hasOffsets: meta.hasOffsets,
            hasColorDialog: meta.hasColorDialog,
            hasFontDialog: meta.hasFontDialog,
            slots: filteredSlots,
            hiddenProps,
            meta,
        };
    }

    private addImports(sourceFile: SourceFile, widgets: JsxWidget[]): void {
        sourceFile.addImportDeclaration({
            moduleSpecifier: "react",
            namedImports: ["ReactNode", "Ref"],
            isTypeOnly: true,
        });

        sourceFile.addImportDeclaration({
            moduleSpecifier: "../types.js",
            namedImports: [
                "EventControllerProps",
                "DragSourceProps",
                "DropTargetProps",
                "GestureDragProps",
                "GestureStylusProps",
                "GestureRotateProps",
                "GestureSwipeProps",
                "GestureLongPressProps",
                "GestureZoomProps",
            ],
            isTypeOnly: true,
        });

        const usedNamespaces = new Set<string>(["Gtk"]);
        for (const widget of widgets) {
            usedNamespaces.add(widget.namespace);
        }

        for (const ns of this.propsBuilder.getUsedNamespaces()) {
            usedNamespaces.add(ns);
        }

        addNamespaceImports(sourceFile, usedNamespaces, { isTypeOnly: true });
    }

    private generateWidgetNotifyProps(sourceFile: SourceFile, widgets: JsxWidget[]): void {
        const widgetMeta = widgets.find((w) => w.className === "Widget");
        if (!widgetMeta) return;

        const propNames = [...widgetMeta.meta.propNames].sort();
        const propsUnion = this.propsBuilder.buildWidgetNotifyPropsType(propNames);

        sourceFile.addTypeAlias({
            name: "WidgetNotifyProps",
            type: propsUnion,
            isExported: true,
            docs: [{ description: "Property names that can be passed to the onNotify callback for Widget." }],
        });
    }

    private generateBaseWidgetProps(sourceFile: SourceFile, widgets: JsxWidget[]): void {
        const widgetMeta = widgets.find((w) => w.className === "Widget");
        if (!widgetMeta) return;

        this.propsBuilder.buildWidgetPropsType(
            sourceFile,
            "Gtk",
            widgetMeta.meta.properties,
            widgetMeta.meta.signals,
            undefined,
        );
    }

    private generateWidgetPropsInterfaces(sourceFile: SourceFile, widgets: JsxWidget[]): void {
        for (const widget of widgets) {
            if (widget.className === "Widget") continue;

            const filteredProperties = widget.meta.properties.filter((p) => !widget.hiddenProps.has(p.camelName));
            const filteredSignals = widget.meta.signals.filter((s) => !widget.hiddenProps.has(s.handlerName));

            const allPropNamesKebab = widget.meta.propNames;

            this.propsBuilder.buildWidgetSpecificPropsInterface(
                sourceFile,
                widget,
                filteredProperties,
                filteredSignals,
                allPropNamesKebab,
            );
        }
    }
}
