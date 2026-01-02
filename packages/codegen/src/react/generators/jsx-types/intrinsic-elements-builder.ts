/**
 * Intrinsic Elements Builder
 *
 * Builds JSX intrinsic elements using pre-computed metadata.
 * Uses slots from CodegenWidgetMeta (SINGLE SOURCE OF TRUTH).
 *
 * Optimized to use ts-morph structures API for batched operations.
 */

import type { OptionalKind, PropertySignatureStructure, SourceFile } from "ts-morph";
import { ModuleDeclarationKind, StructureKind } from "ts-morph";
import { toCamelCase } from "../../../core/utils/naming.js";
import { createConstExport } from "../../../core/utils/structure-helpers.js";
import type { JsxWidget } from "./generator.js";

/**
 * Builds JSX intrinsic elements using pre-computed metadata.
 * Gets slots from CodegenWidgetMeta (SINGLE SOURCE OF TRUTH).
 */
export class IntrinsicElementsBuilder {
    /**
     * Builds widget export constants.
     * Uses ts-morph structures API for batched operations.
     */
    buildWidgetExports(sourceFile: SourceFile, widgets: JsxWidget[]): void {
        const statements = widgets.map((widget) => createConstExport(widget.jsxName, `"${widget.jsxName}" as const`));

        sourceFile.addVariableStatements(statements);
    }

    /**
     * Builds the global JSX namespace declaration.
     * Uses nested statements for single addModule call with complete hierarchy.
     */
    buildJsxNamespace(sourceFile: SourceFile, widgets: JsxWidget[]): void {
        const intrinsicProperties = widgets
            .filter((w) => w.className !== "Widget")
            .map((w) => ({
                name: w.jsxName,
                type: `${w.jsxName}Props`,
            }));

        sourceFile.addModule({
            name: "global",
            declarationKind: ModuleDeclarationKind.Global,
            hasDeclareKeyword: true,
            statements: [
                {
                    kind: StructureKind.Module,
                    name: "React",
                    declarationKind: ModuleDeclarationKind.Namespace,
                    statements: [
                        {
                            kind: StructureKind.Module,
                            name: "JSX",
                            declarationKind: ModuleDeclarationKind.Namespace,
                            statements: [
                                {
                                    kind: StructureKind.Interface,
                                    name: "IntrinsicElements",
                                    properties: intrinsicProperties,
                                },
                            ],
                        },
                    ],
                },
            ],
        });
    }

    /**
     * Builds the WidgetSlotNames type mapping widgets to their valid slot property names.
     * Uses pre-filtered slots from JsxWidget (already filtered for hidden props).
     */
    buildWidgetSlotNamesType(sourceFile: SourceFile, widgets: JsxWidget[]): void {
        const properties: OptionalKind<PropertySignatureStructure>[] = [];

        for (const widget of widgets) {
            const slotNames = widget.slots.map((slot) => toCamelCase(slot));

            if (slotNames.length > 0) {
                const unionType = slotNames.map((name) => `"${name}"`).join(" | ");
                properties.push({
                    name: widget.jsxName,
                    type: unionType,
                });
            }
        }

        if (properties.length === 0) {
            sourceFile.addTypeAlias({
                kind: StructureKind.TypeAlias,
                name: "WidgetSlotNames",
                type: "Record<string, never>",
                isExported: true,
                docs: [{ description: "Type mapping widgets to their valid slot names." }],
            });
        } else {
            sourceFile.addInterface({
                kind: StructureKind.Interface,
                name: "WidgetSlotNames",
                isExported: true,
                docs: [
                    {
                        description:
                            "Type mapping widgets to their valid slot names. Used for type-safe Slot components.\nDerived from CodegenWidgetMeta (single source of truth).",
                    },
                ],
                properties,
            });
        }
    }

    /**
     * Adds the export {} statement to ensure the file is a module.
     */
    addModuleExport(sourceFile: SourceFile): void {
        sourceFile.addExportDeclaration({
            kind: StructureKind.ExportDeclaration,
            namedExports: [],
        });
    }
}
