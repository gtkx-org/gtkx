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
import { PACK_INTERFACE_METHODS, PREFIX_SUFFIX_INTERFACE_METHODS, WIDGET_CLASSIFICATIONS } from "../constants/index.js";
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

    private collectAllWidgets(): WidgetInfo[] {
        return sortWidgetsByClassName(this.reader.getAllWidgets());
    }

    private collectUsedNamespaces(widgets: WidgetInfo[]): Set<string> {
        const usedNamespaces = new Set<string>();

        for (const widget of widgets) {
            const isClassified = WIDGET_CLASSIFICATIONS.some((c) => c.classNames.has(widget.className));
            if (isClassified) {
                usedNamespaces.add(widget.namespace);
            }
        }

        return usedNamespaces;
    }

    private addImports(sourceFile: SourceFile, usedNamespaces: Set<string>): void {
        addNamespaceImports(sourceFile, usedNamespaces);
    }

    private generateClassificationConstants(sourceFile: SourceFile, widgets: WidgetInfo[]): void {
        for (const classification of WIDGET_CLASSIFICATIONS) {
            const matchingWidgets = widgets
                .filter((w) => classification.classNames.has(w.className))
                .map((w) => `${w.namespace}.${w.className}`);

            sourceFile.addVariableStatement(
                createConstExport(classification.name, writeConstIdentifierArray(matchingWidgets), {
                    docs: classification.doc,
                }),
            );
        }

        this.generateInterfaceMethodConstants(sourceFile);
    }

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
