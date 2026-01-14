/**
 * Widget Props Builder
 *
 * Builds widget props type aliases using pre-computed metadata.
 * Works with JsxWidget from JsxTypesGenerator.
 *
 * Optimized to use ts-morph structures API for batched operations.
 */

import type { CodeBlockWriter, SourceFile, WriterFunction } from "ts-morph";
import type { PropertyAnalysis, SignalAnalysis, SignalParam } from "../../../core/generator-types.js";
import { sanitizeDoc } from "../../../core/utils/doc-formatter.js";
import { toPascalCase } from "../../../core/utils/naming.js";
import { qualifyType } from "../../../core/utils/type-qualification.js";
import type { JsxWidget } from "./generator.js";

type PropInfo = {
    name: string;
    type: string;
    optional: boolean;
    doc?: string;
};

/**
 * Builds widget props type aliases using pre-computed metadata.
 * Works with JsxWidget.
 */
export class WidgetPropsBuilder {
    private usedNamespaces = new Set<string>();

    /**
     * Gets the set of namespaces used in type references.
     * Used by JsxTypesGenerator to generate only necessary imports.
     */
    getUsedNamespaces(): ReadonlySet<string> {
        return this.usedNamespaces;
    }

    /**
     * Clears the tracked namespaces.
     * Should be called before processing a new set of widgets.
     */
    clearUsedNamespaces(): void {
        this.usedNamespaces.clear();
    }

    private trackNamespacesFromAnalysis(referencedNamespaces: readonly string[]): void {
        for (const ns of referencedNamespaces) {
            this.usedNamespaces.add(ns);
        }
    }

    /**
     * Builds the WidgetNotifyProps type literal.
     */
    buildWidgetNotifyPropsType(widgetPropNames: string[]): string {
        return widgetPropNames.map((n) => `"${n}"`).join(" | ");
    }

    /**
     * Builds the base WidgetProps type alias extending EventControllerProps.
     */
    buildWidgetPropsType(
        sourceFile: SourceFile,
        namespace: string,
        properties: readonly PropertyAnalysis[],
        signals: readonly SignalAnalysis[],
        widgetDoc?: string,
    ): void {
        const allProps: PropInfo[] = [];

        for (const prop of properties) {
            if (!prop.isWritable || !prop.setter) continue;
            this.trackNamespacesFromAnalysis(prop.referencedNamespaces);
            const qualifiedType = qualifyType(prop.type, namespace);
            const typeWithNull = prop.isNullable ? `${qualifiedType} | null` : qualifiedType;
            allProps.push({
                name: prop.camelName,
                type: typeWithNull,
                optional: true,
                doc: prop.doc ? this.formatDocDescription(prop.doc, namespace) : undefined,
            });
        }

        for (const signal of signals) {
            this.trackNamespacesFromAnalysis(signal.referencedNamespaces);
            allProps.push({
                name: signal.handlerName,
                type: `${this.buildHandlerType(signal, "Widget", namespace)} | null`,
                optional: true,
                doc: signal.doc ? this.formatDocDescription(signal.doc, namespace) : undefined,
            });
        }

        allProps.push({
            name: "grabFocus",
            type: "boolean",
            optional: true,
            doc: "When set to true, the widget will grab focus. Useful for focusing a widget when a condition becomes true.",
        });

        sourceFile.addTypeAlias({
            name: "WidgetProps",
            isExported: true,
            docs: widgetDoc ? [{ description: this.formatDocDescription(widgetDoc, namespace) }] : undefined,
            type: this.buildIntersectionTypeWriter(
                "EventControllerProps & DragSourceProps & DropTargetProps & GestureDragProps",
                allProps,
            ),
        });
    }

    /**
     * Builds a widget-specific props type alias.
     * Uses ts-morph structures API for batched operations.
     */
    buildWidgetSpecificPropsInterface(
        sourceFile: SourceFile,
        widget: JsxWidget,
        properties: readonly PropertyAnalysis[],
        signals: readonly SignalAnalysis[],
        allPropNamesKebab: readonly string[],
    ): void {
        const { namespace, jsxName, className } = widget;
        const widgetName = toPascalCase(className);
        const parentPropsName = this.getParentPropsName(widget);

        const allProps: PropInfo[] = [];

        for (const prop of properties) {
            if (!prop.isWritable || !prop.setter) continue;
            this.trackNamespacesFromAnalysis(prop.referencedNamespaces);
            const qualifiedType = qualifyType(prop.type, namespace);
            const isOptional = !prop.isRequired;
            const typeWithNull = prop.isNullable ? `${qualifiedType} | null` : qualifiedType;
            allProps.push({
                name: prop.camelName,
                type: typeWithNull,
                optional: isOptional,
                doc: prop.doc ? this.formatDocDescription(prop.doc, namespace) : undefined,
            });
        }

        for (const signal of signals) {
            this.trackNamespacesFromAnalysis(signal.referencedNamespaces);
            allProps.push({
                name: signal.handlerName,
                type: `${this.buildHandlerType(signal, className, namespace)} | null`,
                optional: true,
                doc: signal.doc ? this.formatDocDescription(signal.doc, namespace) : undefined,
            });
        }

        allProps.push(...this.getSpecialWidgetProperties(widget));

        if (
            widget.isContainer ||
            widget.isListWidget ||
            widget.isColumnViewWidget ||
            widget.isDropDownWidget ||
            widget.isAdjustable ||
            widget.hasVirtualChildren
        ) {
            allProps.push({
                name: "children",
                type: "ReactNode",
                optional: true,
            });
        }

        const propsUnion = allPropNamesKebab.length > 0 ? allPropNamesKebab.map((n) => `"${n}"`).join(" | ") : "string";
        allProps.push({
            name: "onNotify",
            type: `((self: ${namespace}.${widgetName}, propName: ${propsUnion}) => void) | null`,
            optional: true,
            doc: "Called when any property on this widget changes.\n@param self - The widget that emitted the notification\n@param propName - The name of the property that changed (in kebab-case)",
        });

        allProps.push({
            name: "ref",
            type: `Ref<${namespace}.${widgetName}>`,
            optional: true,
        });

        sourceFile.addTypeAlias({
            name: `${jsxName}Props`,
            isExported: true,
            docs: [{ description: `Props for the {@link ${jsxName}} widget.` }],
            type: this.buildIntersectionTypeWriter(parentPropsName, allProps),
        });
    }

    private getSpecialWidgetProperties(widget: JsxWidget): PropInfo[] {
        const props: PropInfo[] = [];

        if (widget.isListWidget || widget.isColumnViewWidget) {
            props.push(
                {
                    name: "selected",
                    type: "string[] | null",
                    optional: true,
                    doc: "Array of selected item IDs",
                },
                {
                    name: "onSelectionChanged",
                    type: "((ids: string[]) => void) | null",
                    optional: true,
                    doc: "Called when selection changes with array of selected item IDs",
                },
                {
                    name: "selectionMode",
                    type: 'import("@gtkx/ffi/gtk").SelectionMode | null',
                    optional: true,
                    doc: "Selection mode: SINGLE (default) or MULTIPLE",
                },
            );
        }

        if (widget.isColumnViewWidget) {
            props.push(
                {
                    name: "sortColumn",
                    type: "string | null",
                    optional: true,
                    doc: "ID of the currently sorted column, or null if unsorted",
                },
                {
                    name: "sortOrder",
                    type: 'import("@gtkx/ffi/gtk").SortType | null',
                    optional: true,
                    doc: "The current sort direction",
                },
                {
                    name: "onSortChange",
                    type: '((column: string | null, order: import("@gtkx/ffi/gtk").SortType) => void) | null',
                    optional: true,
                    doc: "Called when a column header is clicked to change sort",
                },
                {
                    name: "estimatedRowHeight",
                    type: "number | null",
                    optional: true,
                    doc: "Estimated row height in pixels for proper virtualization before content loads",
                },
            );
        }

        if (widget.isListWidget) {
            props.push({
                name: "renderItem",
                type: '(item: any) => import("react").ReactNode',
                optional: false,
                doc: "Render function for list items.\nCalled with null during setup (for loading state) and with the actual item during bind.",
            });
        }

        if (widget.isDropDownWidget) {
            props.push(
                {
                    name: "selectedId",
                    type: "string | null",
                    optional: true,
                    doc: "ID of the initially selected item",
                },
                {
                    name: "onSelectionChanged",
                    type: "((id: string) => void) | null",
                    optional: true,
                    doc: "Called when selection changes with the selected item's ID",
                },
            );
        }

        if (widget.isNavigationView) {
            props.push(
                {
                    name: "history",
                    type: "string[] | null",
                    optional: true,
                    doc: "Array of page IDs representing the navigation stack. The last ID is the visible page.",
                },
                {
                    name: "onHistoryChanged",
                    type: "((history: string[]) => void) | null",
                    optional: true,
                    doc: "Called when the navigation history changes due to user interaction (back button, swipe gesture).",
                },
            );
        }

        if (widget.isStack) {
            props.push({
                name: "page",
                type: "string | null",
                optional: true,
                doc: "ID of the visible page in the stack.",
            });
        }

        if (widget.isWindow) {
            props.push({
                name: "onClose",
                type: "(() => void) | null",
                optional: true,
                doc: "Called when the window close button is clicked. Control window visibility using React state.",
            });
        }

        if (widget.isDrawingArea) {
            props.push({
                name: "onDraw",
                type: '((self: import("@gtkx/ffi/gtk").DrawingArea, cr: import("@gtkx/ffi/cairo").Context, width: number, height: number) => void) | null',
                optional: true,
                doc: "Called to draw the contents of the drawing area.\n@param self - The drawing area widget\n@param cr - The Cairo context to draw with\n@param width - The actual width of the drawing area\n@param height - The actual height of the drawing area",
            });
        }

        return props;
    }

    private getParentPropsName(widget: JsxWidget): string {
        const { meta } = widget;
        const parentClassName = meta.parentClassName;
        const parentNamespace = meta.parentNamespace ?? meta.namespace;

        if (!parentClassName || parentClassName === "Widget") {
            return "WidgetProps";
        }

        const baseName = toPascalCase(parentClassName);
        return `Omit<${parentNamespace}${baseName}Props, "onNotify">`;
    }

    private buildHandlerType(signal: SignalAnalysis, widgetName: string, namespace: string): string {
        const selfParam = `self: ${namespace}.${toPascalCase(widgetName)}`;
        const otherParams = signal.parameters.map((p: SignalParam) => `${p.name}: ${p.type}`).join(", ");
        const params = otherParams ? `${selfParam}, ${otherParams}` : selfParam;
        return `(${params}) => ${signal.returnType}`;
    }

    private formatDocDescription(doc: string, namespace: string): string {
        return sanitizeDoc(doc, {
            namespace,
            escapeXmlTags: true,
            linkStyle: "prefixed",
        });
    }

    private buildIntersectionTypeWriter(parentType: string, props: PropInfo[]): WriterFunction {
        return (writer: CodeBlockWriter) => {
            writer.write(`${parentType} & {`);
            writer.newLine();
            writer.indent(() => {
                for (const prop of props) {
                    if (prop.doc) {
                        this.writeJsDoc(writer, prop.doc);
                    }
                    const questionMark = prop.optional ? "?" : "";
                    writer.writeLine(`${prop.name}${questionMark}: ${prop.type};`);
                }
            });
            writer.write("}");
        };
    }

    private writeJsDoc(writer: CodeBlockWriter, doc: string): void {
        const lines = doc.split("\n");
        if (lines.length === 1) {
            writer.writeLine(`/** ${doc} */`);
        } else {
            writer.writeLine("/**");
            for (const line of lines) {
                writer.writeLine(` * ${line}`);
            }
            writer.writeLine(" */");
        }
    }
}
