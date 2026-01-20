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
                "EventControllerProps & DragSourceProps & DropTargetProps & GestureDragProps & GestureStylusProps & GestureRotateProps",
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

        const existingPropNames = new Set(allProps.map((p) => p.name));
        const specialProps = this.getSpecialWidgetProperties(widget).filter((p) => !existingPropNames.has(p.name));
        allProps.push(...specialProps);

        if (
            widget.isContainer ||
            widget.isListWidget ||
            widget.isColumnViewWidget ||
            widget.isDropDownWidget ||
            widget.hasBuffer
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

        if (widget.isAdjustable) {
            props.push(
                {
                    name: "value",
                    type: "number",
                    optional: true,
                    doc: "The current value of the adjustment",
                },
                {
                    name: "lower",
                    type: "number",
                    optional: true,
                    doc: "The minimum value",
                },
                {
                    name: "upper",
                    type: "number",
                    optional: true,
                    doc: "The maximum value",
                },
                {
                    name: "stepIncrement",
                    type: "number",
                    optional: true,
                    doc: "The increment for arrow keys",
                },
                {
                    name: "pageIncrement",
                    type: "number",
                    optional: true,
                    doc: "The increment for page up/down",
                },
                {
                    name: "pageSize",
                    type: "number",
                    optional: true,
                    doc: "The page size (usually 0 for scales)",
                },
                {
                    name: "onValueChanged",
                    type: "((value: number) => void) | null",
                    optional: true,
                    doc: "Callback when the value changes",
                },
            );
        }

        if (widget.hasMarks && widget.className === "Scale") {
            this.usedNamespaces.add("Gtk");
            props.push({
                name: "marks",
                type: "Array<{ value: number; position?: Gtk.PositionType; label?: string | null }> | null",
                optional: true,
                doc: "Array of marks to display on the scale",
            });
        }

        if (widget.hasMarks && widget.className === "Calendar") {
            props.push({
                name: "markedDays",
                type: "number[] | null",
                optional: true,
                doc: "Array of day numbers (1-31) to mark on the calendar",
            });
        }

        if (widget.hasOffsets) {
            props.push({
                name: "offsets",
                type: "Array<{ id: string; value: number }> | null",
                optional: true,
                doc: "Array of named offset thresholds for visual style changes",
            });
        }

        if (widget.hasBuffer && widget.className === "TextView") {
            this.usedNamespaces.add("Gtk");
            props.push(
                {
                    name: "enableUndo",
                    type: "boolean",
                    optional: true,
                    doc: "Whether to enable undo/redo",
                },
                {
                    name: "onBufferChanged",
                    type: "((buffer: Gtk.TextBuffer) => void) | null",
                    optional: true,
                    doc: "Callback when the buffer content changes. Use buffer.getText() to extract text.",
                },
                {
                    name: "onTextInserted",
                    type: "((buffer: Gtk.TextBuffer, offset: number, text: string) => void) | null",
                    optional: true,
                    doc: "Callback when text is inserted into the buffer",
                },
                {
                    name: "onTextDeleted",
                    type: "((buffer: Gtk.TextBuffer, startOffset: number, endOffset: number) => void) | null",
                    optional: true,
                    doc: "Callback when text is deleted from the buffer",
                },
                {
                    name: "onCanUndoChanged",
                    type: "((canUndo: boolean) => void) | null",
                    optional: true,
                    doc: "Callback when can-undo state changes",
                },
                {
                    name: "onCanRedoChanged",
                    type: "((canRedo: boolean) => void) | null",
                    optional: true,
                    doc: "Callback when can-redo state changes",
                },
            );
        }

        if (widget.hasBuffer && widget.namespace === "GtkSource") {
            this.usedNamespaces.add("Gtk");
            this.usedNamespaces.add("GtkSource");
            props.push(
                {
                    name: "enableUndo",
                    type: "boolean",
                    optional: true,
                    doc: "Whether to enable undo/redo",
                },
                {
                    name: "onBufferChanged",
                    type: "((buffer: Gtk.TextBuffer) => void) | null",
                    optional: true,
                    doc: "Callback when the buffer content changes. Use buffer.getText() to extract text.",
                },
                {
                    name: "onTextInserted",
                    type: "((buffer: Gtk.TextBuffer, offset: number, text: string) => void) | null",
                    optional: true,
                    doc: "Callback when text is inserted into the buffer",
                },
                {
                    name: "onTextDeleted",
                    type: "((buffer: Gtk.TextBuffer, startOffset: number, endOffset: number) => void) | null",
                    optional: true,
                    doc: "Callback when text is deleted from the buffer",
                },
                {
                    name: "onCanUndoChanged",
                    type: "((canUndo: boolean) => void) | null",
                    optional: true,
                    doc: "Callback when can-undo state changes",
                },
                {
                    name: "onCanRedoChanged",
                    type: "((canRedo: boolean) => void) | null",
                    optional: true,
                    doc: "Callback when can-redo state changes",
                },
                {
                    name: "language",
                    type: "string | GtkSource.Language",
                    optional: true,
                    doc: 'Language for syntax highlighting. Can be a language ID string (e.g., "typescript", "python") or a GtkSource.Language object.',
                },
                {
                    name: "styleScheme",
                    type: "string | GtkSource.StyleScheme",
                    optional: true,
                    doc: 'Style scheme for syntax highlighting colors. Can be a scheme ID string (e.g., "Adwaita-dark") or a GtkSource.StyleScheme object.',
                },
                {
                    name: "highlightSyntax",
                    type: "boolean",
                    optional: true,
                    doc: "Whether to enable syntax highlighting. Defaults to true when language is set.",
                },
                {
                    name: "highlightMatchingBrackets",
                    type: "boolean",
                    optional: true,
                    doc: "Whether to highlight matching brackets when cursor is on a bracket. Defaults to true.",
                },
                {
                    name: "implicitTrailingNewline",
                    type: "boolean",
                    optional: true,
                    doc: "Whether the buffer has an implicit trailing newline.",
                },
                {
                    name: "onCursorMoved",
                    type: "(() => void) | null",
                    optional: true,
                    doc: "Callback when the cursor position changes",
                },
                {
                    name: "onHighlightUpdated",
                    type: "((start: Gtk.TextIter, end: Gtk.TextIter) => void) | null",
                    optional: true,
                    doc: "Callback when syntax highlighting is updated for a region",
                },
            );
        }

        if (widget.isListWidget || widget.isColumnViewWidget) {
            this.usedNamespaces.add("Gtk");
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
                    type: "Gtk.SelectionMode | null",
                    optional: true,
                    doc: "Selection mode: SINGLE (default) or MULTIPLE",
                },
            );
        }

        if (widget.isColumnViewWidget) {
            this.usedNamespaces.add("Gtk");
            props.push(
                {
                    name: "sortColumn",
                    type: "string | null",
                    optional: true,
                    doc: "ID of the currently sorted column, or null if unsorted",
                },
                {
                    name: "sortOrder",
                    type: "Gtk.SortType | null",
                    optional: true,
                    doc: "The current sort direction",
                },
                {
                    name: "onSortChanged",
                    type: "((column: string | null, order: Gtk.SortType) => void) | null",
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
                type: "(item: any) => ReactNode",
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
            this.usedNamespaces.add("Gtk");
            this.usedNamespaces.add("cairo");
            props.push({
                name: "onDraw",
                type: "((self: Gtk.DrawingArea, cr: cairo.Context, width: number, height: number) => void) | null",
                optional: true,
                doc: "Called to draw the contents of the drawing area.\n@param self - The drawing area widget\n@param cr - The Cairo context to draw with\n@param width - The actual width of the drawing area\n@param height - The actual height of the drawing area",
            });
        }

        if (widget.hasColorDialog) {
            this.usedNamespaces.add("Gdk");
            props.push(
                {
                    name: "onRgbaChanged",
                    type: "((rgba: Gdk.RGBA) => void) | null",
                    optional: true,
                    doc: "Callback when the selected color changes",
                },
                {
                    name: "title",
                    type: "string",
                    optional: true,
                    doc: "Title for the color dialog",
                },
                {
                    name: "modal",
                    type: "boolean",
                    optional: true,
                    doc: "Whether the dialog is modal",
                },
                {
                    name: "withAlpha",
                    type: "boolean",
                    optional: true,
                    doc: "Whether to show the alpha channel selector",
                },
            );
        }

        if (widget.hasFontDialog) {
            this.usedNamespaces.add("Gtk");
            this.usedNamespaces.add("Pango");
            props.push(
                {
                    name: "onFontDescChanged",
                    type: "((fontDesc: Pango.FontDescription) => void) | null",
                    optional: true,
                    doc: "Callback when the selected font changes",
                },
                {
                    name: "title",
                    type: "string",
                    optional: true,
                    doc: "Title for the font dialog",
                },
                {
                    name: "modal",
                    type: "boolean",
                    optional: true,
                    doc: "Whether the dialog is modal",
                },
                {
                    name: "language",
                    type: "Pango.Language | null",
                    optional: true,
                    doc: "The language for which font features are used",
                },
                {
                    name: "useFont",
                    type: "boolean",
                    optional: true,
                    doc: "Whether the button label renders in the selected font",
                },
                {
                    name: "useSize",
                    type: "boolean",
                    optional: true,
                    doc: "Whether the button label renders at the selected size",
                },
                {
                    name: "level",
                    type: "Gtk.FontLevel",
                    optional: true,
                    doc: "The level of font selection (family, face, font, or features)",
                },
            );
        }

        if (widget.className === "AboutDialog" && widget.namespace === "Gtk") {
            props.push({
                name: "creditSections",
                type: "Array<{ name: string; people: string[] }>",
                optional: true,
                doc: "Custom credit sections to add to the Credits page. Each section has a name and list of people. Changes to this prop after mount are ignored.",
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
        const omitList = widget.isAdjustable ? '"onNotify" | "onValueChanged"' : '"onNotify"';
        return `Omit<${parentNamespace}${baseName}Props, ${omitList}>`;
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
