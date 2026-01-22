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

import type { CodegenControllerMeta } from "../../core/codegen-metadata.js";
import {
    ADJUSTABLE_INTERFACE_METHODS,
    PACK_INTERFACE_METHODS,
    PREFIX_SUFFIX_INTERFACE_METHODS,
    WIDGET_CLASSIFICATIONS,
} from "../../core/config/index.js";
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
        const allControllers = this.collectAllControllers();
        const usedNamespaces = this.collectUsedNamespaces(allWidgets, allControllers);

        this.addImports(sourceFile, usedNamespaces);
        this.generateClassificationConstants(sourceFile, allWidgets);
        this.generateConstructorProps(sourceFile, allWidgets);
        this.generatePropsMap(sourceFile, allWidgets, allControllers);
        this.generateSignalsMap(sourceFile, allWidgets, allControllers);
        this.generateControllerMetadata(sourceFile, allControllers);

        return sourceFile;
    }

    private collectAllWidgets(): WidgetInfo[] {
        return sortWidgetsByClassName(this.reader.getAllWidgets());
    }

    private collectAllControllers(): CodegenControllerMeta[] {
        return this.project.metadata.getAllControllerMeta().sort((a, b) => a.className.localeCompare(b.className));
    }

    private collectUsedNamespaces(widgets: WidgetInfo[], controllers: CodegenControllerMeta[]): Set<string> {
        const usedNamespaces = new Set<string>();

        for (const widget of widgets) {
            if (widget.classification !== null) {
                usedNamespaces.add(widget.namespace);
            }
        }

        for (const controller of controllers) {
            usedNamespaces.add(controller.namespace);
        }

        return usedNamespaces;
    }

    private addImports(sourceFile: SourceFile, usedNamespaces: Set<string>): void {
        addNamespaceImports(sourceFile, usedNamespaces);
    }

    private generateClassificationConstants(sourceFile: SourceFile, widgets: WidgetInfo[]): void {
        for (const classification of WIDGET_CLASSIFICATIONS) {
            const matchingWidgets = widgets
                .filter((w) => w.classification === classification.type)
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

        sourceFile.addVariableStatement(
            createConstExport("ADJUSTABLE_INTERFACE_METHODS", writeStringArray([...ADJUSTABLE_INTERFACE_METHODS]), {
                docs: "Methods that define the adjustable interface (widgets with GtkAdjustment).",
            }),
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

    private generatePropsMap(
        sourceFile: SourceFile,
        widgets: WidgetInfo[],
        controllers: CodegenControllerMeta[],
    ): void {
        const allProperties: Record<string, WriterFunction> = {};

        const allMeta = this.reader.getAllCodegenMeta();
        const metaByJsxName = new Map(allMeta.map((m) => [m.jsxName, m]));

        for (const widget of widgets) {
            const meta = metaByJsxName.get(widget.jsxName);
            if (!meta || meta.properties.length === 0) continue;

            const propProperties: Record<string, string> = {};

            for (const prop of meta.properties) {
                if (!prop.isWritable || !prop.setter) continue;

                const setterName = toCamelCase(prop.setter);
                propProperties[`"${prop.camelName}"`] = `"${setterName}"`;
            }

            if (Object.keys(propProperties).length > 0) {
                allProperties[widget.jsxName] = Writers.object(propProperties);
            }
        }

        for (const controller of controllers) {
            if (controller.properties.length === 0) continue;

            const propProperties: Record<string, string> = {};

            for (const prop of controller.properties) {
                if (!prop.isWritable || !prop.setter) continue;

                const setterName = toCamelCase(prop.setter);
                propProperties[`"${prop.camelName}"`] = `"${setterName}"`;
            }

            if (Object.keys(propProperties).length > 0) {
                allProperties[controller.jsxName] = Writers.object(propProperties);
            }
        }

        sourceFile.addVariableStatement(
            createConstExport("PROPS", writeObjectOrEmpty(allProperties, Writers), {
                type: "Record<string, Record<string, string>>",
            }),
        );
    }

    private generateSignalsMap(
        sourceFile: SourceFile,
        widgets: WidgetInfo[],
        controllers: CodegenControllerMeta[],
    ): void {
        const objectProperties: Record<string, WriterFunction> = {};

        for (const widget of widgets) {
            if (widget.signalNames.length === 0) continue;

            objectProperties[widget.jsxName] = writeStringSet(widget.signalNames);
        }

        for (const controller of controllers) {
            if (controller.signalNames.length === 0) continue;

            objectProperties[controller.jsxName] = writeStringSet([...controller.signalNames]);
        }

        sourceFile.addVariableStatement(
            createConstExport("SIGNALS", writeObjectOrEmpty(objectProperties, Writers), {
                type: "Record<string, Set<string>>",
                docs: "Signal names for widgets and controllers, derived from CodegenMeta.",
            }),
        );
    }

    private generateControllerMetadata(sourceFile: SourceFile, controllers: CodegenControllerMeta[]): void {
        this.generateControllerClasses(sourceFile, controllers);
        this.generateControllerConstructorProps(sourceFile, controllers);
    }

    private generateControllerClasses(sourceFile: SourceFile, controllers: CodegenControllerMeta[]): void {
        const objectProperties: Record<string, WriterFunction> = {};

        for (const controller of controllers) {
            if (controller.abstract) continue;

            const identifier = `${controller.namespace}.${controller.className}`;
            objectProperties[controller.jsxName] = (writer) => writer.write(identifier);
        }

        sourceFile.addVariableStatement(
            createConstExport("CONTROLLER_CLASSES", writeObjectOrEmpty(objectProperties, Writers), {
                docs: "Map from JSX element name to controller class.",
            }),
        );
    }

    private generateControllerConstructorProps(sourceFile: SourceFile, controllers: CodegenControllerMeta[]): void {
        const objectProperties: Record<string, WriterFunction> = {};

        for (const controller of controllers) {
            if (controller.constructorParams.length > 0) {
                objectProperties[controller.jsxName] = writeStringArray([...controller.constructorParams]);
            }
        }

        sourceFile.addVariableStatement(
            createConstExport("CONTROLLER_CONSTRUCTOR_PROPS", writeObjectOrEmpty(objectProperties, Writers), {
                type: "Record<string, string[]>",
                docs: "Constructor props for controllers that require them.",
            }),
        );
    }
}
