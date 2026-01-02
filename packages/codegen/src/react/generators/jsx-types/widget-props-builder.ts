/**
 * Widget Props Builder
 *
 * Builds widget props interfaces using pre-computed metadata.
 * Works with JsxWidget from JsxTypesGenerator.
 *
 * Optimized to use ts-morph structures API for batched operations.
 */

import type { OptionalKind, PropertySignatureStructure, SourceFile } from "ts-morph";
import type { PropertyAnalysis, SignalAnalysis, SignalParam } from "../../../core/generator-types.js";
import { sanitizeDoc } from "../../../core/utils/doc-formatter.js";
import { toPascalCase } from "../../../core/utils/naming.js";
import { qualifyType as baseQualifyType } from "../../../core/utils/type-qualification.js";
import type { JsxWidget } from "./generator.js";

type PropStructure = OptionalKind<PropertySignatureStructure>;

/**
 * Builds widget props interfaces using pre-computed metadata.
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

    /**
     * Tracks namespaces from PropertyAnalysis or SignalAnalysis.
     * Uses the structured referencedNamespaces field instead of parsing strings.
     */
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
     * Builds the base WidgetProps interface.
     * Uses ts-morph structures API for batched operations.
     */
    buildWidgetPropsInterface(
        sourceFile: SourceFile,
        namespace: string,
        properties: readonly PropertyAnalysis[],
        signals: readonly SignalAnalysis[],
        widgetDoc?: string,
    ): void {
        const propStructures: PropStructure[] = properties.map((prop) => {
            this.trackNamespacesFromAnalysis(prop.referencedNamespaces);
            return {
                name: prop.camelName,
                type: `${this.qualifyType(prop.type, namespace)} | null`,
                hasQuestionToken: true,
                docs: prop.doc ? [{ description: this.formatDocDescription(prop.doc, namespace) }] : undefined,
            };
        });

        const signalStructures: PropStructure[] = signals.map((signal) => {
            this.trackNamespacesFromAnalysis(signal.referencedNamespaces);
            return {
                name: signal.handlerName,
                type: `${this.buildHandlerType(signal, "Widget", namespace)} | null`,
                hasQuestionToken: true,
                docs: signal.doc ? [{ description: this.formatDocDescription(signal.doc, namespace) }] : undefined,
            };
        });

        sourceFile.addInterface({
            name: "WidgetProps",
            isExported: true,
            docs: widgetDoc ? [{ description: this.formatDocDescription(widgetDoc, namespace) }] : undefined,
            properties: [...propStructures, ...signalStructures],
        });
    }

    /**
     * Builds a widget-specific props interface.
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

        const allPropertyStructures: PropStructure[] = [];

        for (const prop of properties) {
            this.trackNamespacesFromAnalysis(prop.referencedNamespaces);
            const qualifiedType = this.qualifyType(prop.type, namespace);
            const isOptional = !prop.isRequired;
            allPropertyStructures.push({
                name: prop.camelName,
                type: isOptional ? `${qualifiedType} | null` : qualifiedType,
                hasQuestionToken: isOptional,
                docs: prop.doc ? [{ description: this.formatDocDescription(prop.doc, namespace) }] : undefined,
            });
        }

        for (const signal of signals) {
            this.trackNamespacesFromAnalysis(signal.referencedNamespaces);
            allPropertyStructures.push({
                name: signal.handlerName,
                type: `${this.buildHandlerType(signal, className, namespace)} | null`,
                hasQuestionToken: true,
                docs: signal.doc ? [{ description: this.formatDocDescription(signal.doc, namespace) }] : undefined,
            });
        }

        if (widget.isListWidget || widget.isColumnViewWidget) {
            allPropertyStructures.push(...this.getListWidgetPropertyStructures());
        }

        if (widget.isColumnViewWidget) {
            allPropertyStructures.push(...this.getColumnViewPropertyStructures());
        }

        if (widget.isListWidget) {
            allPropertyStructures.push(...this.getListRenderPropertyStructures());
        }

        if (widget.isDropDownWidget) {
            allPropertyStructures.push(...this.getDropDownPropertyStructures());
        }

        if (widget.isContainer || widget.isListWidget || widget.isColumnViewWidget || widget.isDropDownWidget) {
            allPropertyStructures.push({
                name: "children",
                type: "ReactNode",
                hasQuestionToken: true,
            });
        }

        const propsUnion = allPropNamesKebab.length > 0 ? allPropNamesKebab.map((n) => `"${n}"`).join(" | ") : "string";
        allPropertyStructures.push({
            name: "onNotify",
            type: `((self: ${namespace}.${widgetName}, propName: ${propsUnion}) => void) | null`,
            hasQuestionToken: true,
            docs: [
                {
                    description:
                        "Called when any property on this widget changes.\n@param self - The widget that emitted the notification\n@param propName - The name of the property that changed (in kebab-case)",
                },
            ],
        });

        allPropertyStructures.push({
            name: "ref",
            type: `Ref<${namespace}.${widgetName}>`,
            hasQuestionToken: true,
        });

        sourceFile.addInterface({
            name: `${jsxName}Props`,
            extends: [parentPropsName],
            isExported: true,
            docs: [{ description: `Props for the {@link ${jsxName}} widget.` }],
            properties: allPropertyStructures,
        });
    }

    /**
     * Returns property structures for list widgets.
     */
    private getListWidgetPropertyStructures(): PropStructure[] {
        return [
            {
                name: "selected",
                type: "string[] | null",
                hasQuestionToken: true,
                docs: [{ description: "Array of selected item IDs" }],
            },
            {
                name: "onSelectionChanged",
                type: "((ids: string[]) => void) | null",
                hasQuestionToken: true,
                docs: [{ description: "Called when selection changes with array of selected item IDs" }],
            },
            {
                name: "selectionMode",
                type: 'import("@gtkx/ffi/gtk").SelectionMode | null',
                hasQuestionToken: true,
                docs: [{ description: "Selection mode: SINGLE (default) or MULTIPLE" }],
            },
        ];
    }

    /**
     * Returns property structures for column view widgets.
     */
    private getColumnViewPropertyStructures(): PropStructure[] {
        return [
            {
                name: "sortColumn",
                type: "string | null",
                hasQuestionToken: true,
                docs: [{ description: "ID of the currently sorted column, or null if unsorted" }],
            },
            {
                name: "sortOrder",
                type: 'import("@gtkx/ffi/gtk").SortType | null',
                hasQuestionToken: true,
                docs: [{ description: "The current sort direction" }],
            },
            {
                name: "onSortChange",
                type: '((column: string | null, order: import("@gtkx/ffi/gtk").SortType) => void) | null',
                hasQuestionToken: true,
                docs: [{ description: "Called when a column header is clicked to change sort" }],
            },
        ];
    }

    /**
     * Returns property structures for list render props.
     */
    private getListRenderPropertyStructures(): PropStructure[] {
        return [
            {
                name: "renderItem",
                type: '(item: any) => import("react").ReactNode',
                hasQuestionToken: false,
                docs: [
                    {
                        description:
                            "Render function for list items.\nCalled with null during setup (for loading state) and with the actual item during bind.",
                    },
                ],
            },
        ];
    }

    /**
     * Returns property structures for dropdown widgets.
     */
    private getDropDownPropertyStructures(): PropStructure[] {
        return [
            {
                name: "selectedId",
                type: "string | null",
                hasQuestionToken: true,
                docs: [{ description: "ID of the initially selected item" }],
            },
            {
                name: "onSelectionChanged",
                type: "((id: string) => void) | null",
                hasQuestionToken: true,
                docs: [{ description: "Called when selection changes with the selected item's ID" }],
            },
        ];
    }

    /**
     * Gets the parent props interface name for a widget.
     * Handles cross-namespace inheritance (e.g., Adw.Window extends Gtk.Window).
     */
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

    /**
     * Builds the handler type string for a signal.
     * Namespaces are tracked via trackNamespacesFromAnalysis in the caller.
     */
    private buildHandlerType(signal: SignalAnalysis, widgetName: string, namespace: string): string {
        const selfParam = `self: ${namespace}.${toPascalCase(widgetName)}`;
        const otherParams = signal.parameters.map((p: SignalParam) => `${p.name}: ${p.type}`).join(", ");
        const params = otherParams ? `${selfParam}, ${otherParams}` : selfParam;
        return `(${params}) => ${signal.returnType}`;
    }

    /**
     * Qualifies a type string with the namespace prefix.
     */
    private qualifyType(tsType: string, namespace: string): string {
        return baseQualifyType(tsType, namespace);
    }

    private formatDocDescription(doc: string, namespace: string): string {
        return sanitizeDoc(doc, {
            namespace,
            escapeXmlTags: true,
            linkStyle: "prefixed",
        });
    }
}
