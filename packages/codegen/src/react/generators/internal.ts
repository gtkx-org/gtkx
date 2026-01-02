/**
 * Internal Generator
 *
 * Generates internal.ts for the reconciler.
 * This is the SINGLE SOURCE OF TRUTH for widget classification.
 *
 * Classification constants:
 * - LIST_WIDGET_CLASSES: ListView, GridView (require renderItem prop)
 * - DROP_DOWN_CLASSES: DropDown, ComboRow (special item handling)
 * - COLUMN_VIEW_CLASSES: ColumnView (column-based layout)
 */

import { type SourceFile, type WriterFunction, Writers } from "ts-morph";
import type { CodegenProject } from "../../core/project.js";
import { toCamelCase } from "../../core/utils/naming.js";
import {
    addNamespaceImports,
    createConstExport,
    writeConstIdentifierArray,
    writeObjectOrEmpty,
    writeStringArray,
    writeStringSet,
} from "../../core/utils/structure-helpers.js";
import {
    AUTOWRAP_WIDGET_NAMES,
    COLUMN_VIEW_WIDGET_NAMES,
    DROP_DOWN_WIDGET_NAMES,
    LIST_WIDGET_NAMES,
    NOTEBOOK_WIDGET_NAMES,
    PACK_INTERFACE_METHODS,
    POPOVER_MENU_WIDGET_NAMES,
    PREFIX_SUFFIX_INTERFACE_METHODS,
    STACK_WIDGET_NAMES,
} from "../constants/index.js";
import { type MetadataReader, sortWidgetsByClassName, type WidgetInfo } from "../metadata-reader.js";

/**
 * Generates internal.ts for the reconciler.
 *
 * @example
 * ```typescript
 * const generator = new InternalGenerator(metadataReader, project);
 * const sourceFile = generator.generate();
 * ```
 */
export class InternalGenerator {
    constructor(
        private readonly reader: MetadataReader,
        private readonly project: CodegenProject,
    ) {}

    /**
     * Generates the internal.ts file into the shared project.
     *
     * @returns The created SourceFile containing classification constants and metadata
     */
    generate(): SourceFile {
        const sourceFile = this.project.createReactSourceFile("internal.ts");

        sourceFile.addStatements(
            "/**\n * Internal metadata for the reconciler.\n * This is the SINGLE SOURCE OF TRUTH for widget classification.\n * Not part of the public API.\n */\n",
        );

        const allWidgets = this.collectAllWidgets();
        const usedNamespaces = this.collectUsedNamespaces(allWidgets);

        this.addImports(sourceFile, usedNamespaces);
        this.generateClassificationConstants(sourceFile, allWidgets);
        this.generateConstructorProps(sourceFile, allWidgets);
        this.generatePropsMap(sourceFile, allWidgets);
        this.generateSignalsMap(sourceFile, allWidgets);

        return sourceFile;
    }

    /**
     * Collects all widgets from metadata.
     */
    private collectAllWidgets(): WidgetInfo[] {
        return sortWidgetsByClassName(this.reader.getAllWidgets());
    }

    /**
     * Collects namespaces that are actually used in the classification arrays.
     * Only these namespaces need to be imported.
     */
    private collectUsedNamespaces(widgets: WidgetInfo[]): Set<string> {
        const usedNamespaces = new Set<string>();

        for (const widget of widgets) {
            const isClassified =
                LIST_WIDGET_NAMES.has(widget.className) ||
                DROP_DOWN_WIDGET_NAMES.has(widget.className) ||
                COLUMN_VIEW_WIDGET_NAMES.has(widget.className) ||
                AUTOWRAP_WIDGET_NAMES.has(widget.className) ||
                STACK_WIDGET_NAMES.has(widget.className) ||
                NOTEBOOK_WIDGET_NAMES.has(widget.className) ||
                POPOVER_MENU_WIDGET_NAMES.has(widget.className);

            if (isClassified) {
                usedNamespaces.add(widget.namespace);
            }
        }

        return usedNamespaces;
    }

    /**
     * Adds import declarations for namespaces used in classification.
     */
    private addImports(sourceFile: SourceFile, usedNamespaces: Set<string>): void {
        addNamespaceImports(sourceFile, usedNamespaces);
    }

    /**
     * Generates widget classification constants.
     * These are the SINGLE SOURCE OF TRUTH for widget classification.
     */
    private generateClassificationConstants(sourceFile: SourceFile, widgets: WidgetInfo[]): void {
        const listWidgets: string[] = [];
        const dropDownWidgets: string[] = [];
        const columnViewWidgets: string[] = [];
        const autowrapWidgets: string[] = [];
        const stackWidgets: string[] = [];
        const notebookWidgets: string[] = [];
        const popoverMenuWidgets: string[] = [];

        for (const widget of widgets) {
            const qualifiedRef = `${widget.namespace}.${widget.className}`;

            if (LIST_WIDGET_NAMES.has(widget.className)) {
                listWidgets.push(qualifiedRef);
            }
            if (DROP_DOWN_WIDGET_NAMES.has(widget.className)) {
                dropDownWidgets.push(qualifiedRef);
            }
            if (COLUMN_VIEW_WIDGET_NAMES.has(widget.className)) {
                columnViewWidgets.push(qualifiedRef);
            }
            if (AUTOWRAP_WIDGET_NAMES.has(widget.className)) {
                autowrapWidgets.push(qualifiedRef);
            }
            if (STACK_WIDGET_NAMES.has(widget.className)) {
                stackWidgets.push(qualifiedRef);
            }
            if (NOTEBOOK_WIDGET_NAMES.has(widget.className)) {
                notebookWidgets.push(qualifiedRef);
            }
            if (POPOVER_MENU_WIDGET_NAMES.has(widget.className)) {
                popoverMenuWidgets.push(qualifiedRef);
            }
        }

        const classifications: Array<{
            name: string;
            widgets: string[];
            doc: string;
        }> = [
            {
                name: "LIST_WIDGET_CLASSES",
                widgets: listWidgets,
                doc: "List widgets that require renderItem prop.",
            },
            {
                name: "DROP_DOWN_CLASSES",
                widgets: dropDownWidgets,
                doc: "Dropdown widgets with special item handling.",
            },
            {
                name: "COLUMN_VIEW_CLASSES",
                widgets: columnViewWidgets,
                doc: "Column view widgets with column-based layout.",
            },
            {
                name: "AUTOWRAP_CLASSES",
                widgets: autowrapWidgets,
                doc: "Widgets that auto-wrap children (ListBox wraps in ListBoxRow, FlowBox wraps in FlowBoxChild).",
            },
            {
                name: "STACK_CLASSES",
                widgets: stackWidgets,
                doc: "Stack widgets that show one child at a time.",
            },
            {
                name: "NOTEBOOK_CLASSES",
                widgets: notebookWidgets,
                doc: "Notebook widgets with tabbed interface.",
            },
            {
                name: "POPOVER_MENU_CLASSES",
                widgets: popoverMenuWidgets,
                doc: "Widgets that support popover menu children.",
            },
        ];

        for (const classification of classifications) {
            sourceFile.addVariableStatement(
                createConstExport(classification.name, writeConstIdentifierArray(classification.widgets), {
                    docs: classification.doc,
                }),
            );
        }

        this.generateInterfaceMethodConstants(sourceFile);
    }

    /**
     * Generates interface method constants for duck-typing in node matching.
     */
    private generateInterfaceMethodConstants(sourceFile: SourceFile): void {
        sourceFile.addVariableStatement(
            createConstExport("PACK_INTERFACE_METHODS", writeStringArray([...PACK_INTERFACE_METHODS]), {
                docs: "Methods that define the packable interface (pack start/end positioning).",
            }),
        );

        sourceFile.addVariableStatement(
            createConstExport(
                "PREFIX_SUFFIX_INTERFACE_METHODS",
                writeStringArray([...PREFIX_SUFFIX_INTERFACE_METHODS]),
                {
                    docs: "Methods that define the prefix/suffix interface (Adwaita action rows).",
                },
            ),
        );
    }

    /**
     * Generates constructor props.
     * Uses actual constructor parameter analysis from CodegenWidgetMeta.
     */
    private generateConstructorProps(sourceFile: SourceFile, widgets: WidgetInfo[]): void {
        const objectProperties: Record<string, WriterFunction> = {};

        for (const widget of widgets) {
            if (widget.constructorParams.length > 0) {
                objectProperties[widget.jsxName] = writeStringArray(widget.constructorParams);
            }
        }

        sourceFile.addVariableStatement(
            createConstExport("CONSTRUCTOR_PROPS", writeObjectOrEmpty(objectProperties, Writers), {
                type: "Record<string, string[]>",
                docs: "Constructor parameters for each widget type, derived from GIR analysis.",
            }),
        );
    }

    /**
     * Generates props map using actual getter/setter names from property analysis.
     */
    private generatePropsMap(sourceFile: SourceFile, widgets: WidgetInfo[]): void {
        const widgetProperties: Record<string, WriterFunction> = {};

        const allMeta = this.reader.getAllCodegenMeta();
        const metaByJsxName = new Map(allMeta.map((m) => [m.jsxName, m]));

        for (const widget of widgets) {
            const meta = metaByJsxName.get(widget.jsxName);
            if (!meta || meta.properties.length === 0) continue;

            const propProperties: Record<string, string> = {};

            for (const prop of meta.properties) {
                if (!prop.isWritable || !prop.setter) continue;

                const getterName = prop.getter ? toCamelCase(prop.getter) : null;
                const setterName = toCamelCase(prop.setter);

                propProperties[`"${prop.camelName}"`] = `[${getterName ? `"${getterName}"` : "null"}, "${setterName}"]`;
            }

            if (Object.keys(propProperties).length > 0) {
                widgetProperties[widget.jsxName] = Writers.object(propProperties);
            }
        }

        sourceFile.addVariableStatement(
            createConstExport("PROPS", writeObjectOrEmpty(widgetProperties, Writers), {
                type: "Record<string, Record<string, [string | null, string]>>",
            }),
        );
    }

    /**
     * Generates signals map.
     * Uses WriterFunction for Set literals.
     */
    private generateSignalsMap(sourceFile: SourceFile, widgets: WidgetInfo[]): void {
        const objectProperties: Record<string, WriterFunction> = {};

        for (const widget of widgets) {
            if (widget.signalNames.length === 0) continue;

            objectProperties[widget.jsxName] = writeStringSet(widget.signalNames);
        }

        sourceFile.addVariableStatement(
            createConstExport("SIGNALS", writeObjectOrEmpty(objectProperties, Writers), {
                type: "Record<string, Set<string>>",
                docs: "Signal names for each widget type, derived from CodegenWidgetMeta.",
            }),
        );
    }
}
