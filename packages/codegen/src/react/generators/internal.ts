/**
 * Internal Generator
 *
 * Generates internal.ts for the reconciler.
 * Contains runtime prop/signal resolution and constructor parameters.
 */

import { type SourceFile, type WriterFunction, Writers } from "ts-morph";

import type { CodegenControllerMeta } from "../../core/codegen-metadata.js";
import type { CodegenProject } from "../../core/project.js";
import { toCamelCase } from "../../core/utils/naming.js";
import {
    addNamespaceImports,
    createConstExport,
    writeObjectOrEmpty,
    writeStringArray,
    writeStringSet,
} from "../../core/utils/structure-helpers.js";
import { type MetadataReader, sortWidgetsByClassName, type WidgetInfo } from "../metadata-reader.js";

export class InternalGenerator {
    constructor(
        private readonly reader: MetadataReader,
        private readonly project: CodegenProject,
    ) {}

    generate(): SourceFile {
        const sourceFile = this.project.createReactSourceFile("internal.ts");

        sourceFile.addStatements(
            "/**\n * Internal metadata for the reconciler.\n * Runtime prop/signal resolution and constructor parameters.\n * Not part of the public API.\n */\n",
        );

        const allWidgets = this.collectAllWidgets();
        const allControllers = this.collectAllControllers();
        const usedNamespaces = this.collectUsedNamespaces(allControllers);

        this.addImports(sourceFile, usedNamespaces);
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

    private collectUsedNamespaces(controllers: CodegenControllerMeta[]): Set<string> {
        const usedNamespaces = new Set<string>();

        for (const controller of controllers) {
            usedNamespaces.add(controller.namespace);
        }

        return usedNamespaces;
    }

    private addImports(sourceFile: SourceFile, usedNamespaces: Set<string>): void {
        addNamespaceImports(sourceFile, usedNamespaces);
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

                const getterName = prop.getter ? toCamelCase(prop.getter) : null;
                const setterName = toCamelCase(prop.setter);
                propProperties[`"${prop.camelName}"`] = `[${getterName ? `"${getterName}"` : "null"}, "${setterName}"]`;
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

                const getterName = prop.getter ? toCamelCase(prop.getter) : null;
                const setterName = toCamelCase(prop.setter);
                propProperties[`"${prop.camelName}"`] = `[${getterName ? `"${getterName}"` : "null"}, "${setterName}"]`;
            }

            if (Object.keys(propProperties).length > 0) {
                allProperties[controller.jsxName] = Writers.object(propProperties);
            }
        }

        sourceFile.addVariableStatement(
            createConstExport("PROPS", writeObjectOrEmpty(allProperties, Writers), {
                type: "Record<string, Record<string, [string | null, string]>>",
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
        this.generateControllerConstructorProps(sourceFile, controllers);
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
