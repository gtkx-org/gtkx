/**
 * FFI AST Analyzer
 *
 * Analyzes FFI AST to detect container/slot information.
 * Used by JSX generator to determine widget capabilities.
 *
 * This ensures FFI is the single source of truth for widget structure.
 */

import type { Project, SourceFile } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import { toPascalCase } from "../../core/utils/naming.js";

export type WidgetContainerMeta = {
    isContainer: boolean;
    slots: readonly string[];
};

export class FfiAstAnalyzer {
    private readonly metaCache = new Map<string, Map<string, WidgetContainerMeta>>();

    constructor(private readonly ffiProject: Project) {}

    getWidgetMeta(namespace: string, className: string): WidgetContainerMeta | null {
        return this.getNamespaceMetaMap(namespace).get(className) ?? null;
    }

    isContainer(namespace: string, className: string): boolean {
        return this.getWidgetMeta(namespace, className)?.isContainer ?? false;
    }

    getSlots(namespace: string, className: string): readonly string[] {
        return this.getWidgetMeta(namespace, className)?.slots ?? [];
    }

    getNamespaceMetaMap(namespace: string): Map<string, WidgetContainerMeta> {
        const cached = this.metaCache.get(namespace);
        if (cached) return cached;

        const metaMap = this.buildMetaMap(namespace);
        this.metaCache.set(namespace, metaMap);
        return metaMap;
    }

    private buildMetaMap(namespace: string): Map<string, WidgetContainerMeta> {
        const metaMap = new Map<string, WidgetContainerMeta>();
        const nsLower = namespace.toLowerCase();

        for (const sourceFile of this.ffiProject.getSourceFiles()) {
            const filePath = sourceFile.getFilePath();
            if (!filePath.includes(`/${nsLower}/`)) continue;

            const meta = this.readWidgetMetaFromAST(sourceFile);
            if (meta) {
                const fileName = sourceFile.getBaseNameWithoutExtension();
                const className = toPascalCase(fileName);
                metaMap.set(className, meta);
            }
        }

        return metaMap;
    }

    private readWidgetMetaFromAST(sourceFile: SourceFile): WidgetContainerMeta | null {
        const classes = sourceFile.getClasses();
        if (classes.length === 0) return null;

        const cls = classes[0];
        if (!cls) return null;

        const widgetMetaProp = cls.getStaticProperty("WIDGET_META");
        if (!widgetMetaProp || widgetMetaProp.getKind() !== SyntaxKind.PropertyDeclaration) {
            return null;
        }

        const propDecl = widgetMetaProp.asKind(SyntaxKind.PropertyDeclaration);
        if (!propDecl) return null;

        const initializer = propDecl.getInitializer();
        if (!initializer || initializer.getKind() !== SyntaxKind.ObjectLiteralExpression) {
            return null;
        }

        const objectLiteral = initializer.asKind(SyntaxKind.ObjectLiteralExpression);
        if (!objectLiteral) return null;

        let isContainer = false;
        let slots: string[] = [];

        for (const prop of objectLiteral.getProperties()) {
            if (prop.getKind() !== SyntaxKind.PropertyAssignment) continue;

            const propAssignment = prop.asKind(SyntaxKind.PropertyAssignment);
            if (!propAssignment) continue;

            const name = propAssignment.getName();
            const value = propAssignment.getInitializer();

            if (name === "isContainer" && value) {
                isContainer = value.getText() === "true";
            }

            if (name === "slots" && value) {
                let arrayLiteral = value.asKind(SyntaxKind.ArrayLiteralExpression);

                if (!arrayLiteral && value.getKind() === SyntaxKind.AsExpression) {
                    const asExpr = value.asKind(SyntaxKind.AsExpression);
                    if (asExpr) {
                        arrayLiteral = asExpr.getExpression().asKind(SyntaxKind.ArrayLiteralExpression);
                    }
                }

                if (arrayLiteral) {
                    slots = arrayLiteral
                        .getElements()
                        .map((el) => el.asKind(SyntaxKind.StringLiteral))
                        .filter((el): el is NonNullable<typeof el> => el !== undefined)
                        .map((el) => el.getLiteralValue());
                }
            }
        }

        return { isContainer, slots };
    }
}
