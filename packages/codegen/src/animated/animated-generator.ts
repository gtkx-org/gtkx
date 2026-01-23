import { StructureKind } from "ts-morph";
import type { CodegenWidgetMeta } from "../core/codegen-metadata.js";
import type { CodegenProject } from "../core/project.js";

export class AnimatedGenerator {
    constructor(
        private readonly widgetMeta: readonly CodegenWidgetMeta[],
        private readonly project: CodegenProject,
        private readonly namespaceNames: string[],
    ) {}

    generate(): void {
        const sourceFile = this.project.createAnimatedSourceFile("components.ts");

        const widgets = this.getWidgets();

        sourceFile.addImportDeclaration({
            moduleSpecifier: "react",
            namedImports: ["ForwardRefExoticComponent", "RefAttributes"],
            isTypeOnly: true,
        });

        sourceFile.addImportDeclaration({
            moduleSpecifier: "../types.js",
            namedImports: ["AnimatedProps"],
            isTypeOnly: true,
        });

        const widgetProperties = widgets.map((w) => ({
            name: w.jsxName,
            type: "AnimatedComponentType",
        }));

        sourceFile.addTypeAlias({
            kind: StructureKind.TypeAlias,
            name: "AnyProps",
            type: "Record<string, unknown>",
            isExported: false,
        });

        sourceFile.addTypeAlias({
            kind: StructureKind.TypeAlias,
            name: "AnimatedComponentType",
            type: "ForwardRefExoticComponent<AnimatedProps<AnyProps> & RefAttributes<unknown>>",
            isExported: true,
        });

        sourceFile.addInterface({
            kind: StructureKind.Interface,
            name: "AnimatedComponents",
            isExported: true,
            properties: widgetProperties,
        });
    }

    private getWidgets(): CodegenWidgetMeta[] {
        return this.widgetMeta
            .filter((m) => this.namespaceNames.includes(m.namespace))
            .filter((m) => m.className !== "Widget")
            .sort((a, b) => a.jsxName.localeCompare(b.jsxName));
    }
}
