/**
 * JSX Types Generator
 *
 * Generates JSX type definitions from:
 * - CodegenWidgetMeta: properties, signals, prop names (from FFI generation)
 * - FFI AST: isContainer, slots (derived from WIDGET_META constant)
 * - Internal AST: list/dropdown/columnview classification (from generated internal.ts)
 *
 * This separation ensures:
 * - FFI is the single source of truth for widget structure
 * - Internal.ts is the single source of truth for widget classification
 */

import type { SourceFile } from "ts-morph";
import type { CodegenWidgetMeta } from "../../../core/codegen-metadata.js";
import type { CodegenProject } from "../../../core/project.js";
import { toCamelCase } from "../../../core/utils/naming.js";
import { addNamespaceImports } from "../../../core/utils/structure-helpers.js";
import type { FfiAstAnalyzer, WidgetContainerMeta } from "../../analyzers/index.js";
import {
    COLUMN_VIEW_WIDGET_NAMES,
    DROP_DOWN_WIDGET_NAMES,
    getHiddenProps,
    LIST_WIDGET_NAMES,
} from "../../constants/index.js";
import { type MetadataReader, sortWidgetsByClassName } from "../../metadata-reader.js";
import { IntrinsicElementsBuilder } from "./intrinsic-elements-builder.js";
import { WidgetPropsBuilder } from "./widget-props-builder.js";

/**
 * Widget info for JSX generation (from metadata).
 */
export type JsxWidget = {
    /** Class name (e.g., "Button") */
    className: string;
    /** Full JSX name (e.g., "GtkButton") */
    jsxName: string;
    /** Namespace (e.g., "Gtk") */
    namespace: string;
    /** Is a list widget */
    isListWidget: boolean;
    /** Is a dropdown widget */
    isDropDownWidget: boolean;
    /** Is a column view widget */
    isColumnViewWidget: boolean;
    /** Is a container */
    isContainer: boolean;
    /** Slot names (pre-filtered for hidden props) */
    slots: readonly string[];
    /** Hidden props for this widget (pre-computed for DRY) */
    hiddenProps: Set<string>;
    /** Full metadata */
    meta: CodegenWidgetMeta;
};

/**
 * Generates JSX type definitions.
 *
 * @example
 * ```typescript
 * const generator = new JsxTypesGenerator(metadataReader, ffiAnalyzer, project, ["Gtk", "Adw"]);
 * generator.generate();
 * ```
 */
export class JsxTypesGenerator {
    private readonly propsBuilder = new WidgetPropsBuilder();
    private readonly intrinsicBuilder = new IntrinsicElementsBuilder();

    constructor(
        private readonly reader: MetadataReader,
        private readonly ffiAnalyzer: FfiAstAnalyzer,
        private readonly project: CodegenProject,
        private readonly namespaceNames: string[],
    ) {}

    /**
     * Generates the jsx.ts file into the shared project.
     */
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

    /**
     * Gets widgets from metadata, converting to JsxWidget.
     */
    private getWidgets(): JsxWidget[] {
        const allMeta = this.reader.getAllCodegenMeta();

        const filtered = allMeta.filter((m) => this.namespaceNames.includes(m.namespace));
        const widgets = filtered.map((meta) => this.toJsxWidget(meta));

        return sortWidgetsByClassName(widgets);
    }

    private toJsxWidget(meta: CodegenWidgetMeta): JsxWidget {
        const containerMeta = this.getContainerMeta(meta.namespace, meta.className);
        const hiddenProps = getHiddenProps(meta.className);

        const rawSlots = containerMeta?.slots ?? [];
        const filteredSlots = rawSlots.filter((slot) => !hiddenProps.has(toCamelCase(slot)));

        return {
            className: meta.className,
            jsxName: meta.jsxName,
            namespace: meta.namespace,
            isListWidget: LIST_WIDGET_NAMES.has(meta.className),
            isDropDownWidget: DROP_DOWN_WIDGET_NAMES.has(meta.className),
            isColumnViewWidget: COLUMN_VIEW_WIDGET_NAMES.has(meta.className),
            isContainer: containerMeta?.isContainer ?? false,
            slots: filteredSlots,
            hiddenProps,
            meta,
        };
    }

    /**
     * Gets widget container metadata for a class.
     */
    private getContainerMeta(namespace: string, className: string): WidgetContainerMeta | null {
        return this.ffiAnalyzer.getWidgetMeta(namespace, className);
    }

    /**
     * Adds import declarations to the source file.
     * Uses namespaces tracked during props generation instead of hardcoded list.
     */
    private addImports(sourceFile: SourceFile, widgets: JsxWidget[]): void {
        sourceFile.addImportDeclaration({
            moduleSpecifier: "react",
            namedImports: ["ReactNode", "Ref"],
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

    /**
     * Generates the WidgetNotifyProps type.
     */
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

    /**
     * Generates the base WidgetProps interface.
     */
    private generateBaseWidgetProps(sourceFile: SourceFile, widgets: JsxWidget[]): void {
        const widgetMeta = widgets.find((w) => w.className === "Widget");
        if (!widgetMeta) return;

        this.propsBuilder.buildWidgetPropsInterface(
            sourceFile,
            "Gtk",
            widgetMeta.meta.properties,
            widgetMeta.meta.signals,
            undefined,
        );
    }

    /**
     * Generates widget-specific props interfaces.
     */
    private generateWidgetPropsInterfaces(sourceFile: SourceFile, widgets: JsxWidget[]): void {
        for (const widget of widgets) {
            if (widget.className === "Widget") continue;

            const filteredProperties = widget.meta.properties.filter((p) => !widget.hiddenProps.has(p.camelName));

            const allPropNamesKebab = widget.meta.propNames;

            this.propsBuilder.buildWidgetSpecificPropsInterface(
                sourceFile,
                widget,
                filteredProperties,
                widget.meta.signals,
                allPropNamesKebab,
            );
        }
    }
}
