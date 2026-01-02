import { describe, expect, it } from "vitest";
import type { JsxWidget } from "../../../../src/react/generators/jsx-types/generator.js";
import { IntrinsicElementsBuilder } from "../../../../src/react/generators/jsx-types/intrinsic-elements-builder.js";
import { createButtonMeta, createWidgetMeta } from "../../../fixtures/metadata-fixtures.js";
import { createTestProject, createTestSourceFile, getGeneratedCode } from "../../../fixtures/ts-morph-helpers.js";

function createJsxWidget(overrides: Partial<JsxWidget> = {}): JsxWidget {
    const meta = createButtonMeta();
    return {
        className: "Button",
        jsxName: "GtkButton",
        namespace: "Gtk",
        isListWidget: false,
        isDropDownWidget: false,
        isColumnViewWidget: false,
        isContainer: true,
        slots: [],
        hiddenProps: new Set(),
        meta,
        ...overrides,
    };
}

function createTestSetup() {
    const project = createTestProject();
    const sourceFile = createTestSourceFile(project, "jsx.ts");
    const builder = new IntrinsicElementsBuilder();
    return { project, sourceFile, builder };
}

describe("IntrinsicElementsBuilder", () => {
    describe("constructor", () => {
        it("creates builder instance", () => {
            const builder = new IntrinsicElementsBuilder();
            expect(builder).toBeInstanceOf(IntrinsicElementsBuilder);
        });
    });

    describe("buildWidgetExports", () => {
        it("creates const exports for each widget", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [createJsxWidget({ jsxName: "GtkButton" }), createJsxWidget({ jsxName: "GtkLabel" })];

            builder.buildWidgetExports(sourceFile, widgets);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain('export const GtkButton = "GtkButton" as const');
            expect(code).toContain('export const GtkLabel = "GtkLabel" as const');
        });

        it("creates exported const declarations", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [createJsxWidget({ jsxName: "GtkButton" })];

            builder.buildWidgetExports(sourceFile, widgets);

            const varStatements = sourceFile.getVariableStatements();
            expect(varStatements).toHaveLength(1);
            expect(varStatements[0].isExported()).toBe(true);
        });

        it("handles empty widget list", () => {
            const { sourceFile, builder } = createTestSetup();

            builder.buildWidgetExports(sourceFile, []);

            const varStatements = sourceFile.getVariableStatements();
            expect(varStatements).toHaveLength(0);
        });
    });

    describe("buildJsxNamespace", () => {
        it("creates global declare module", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [createJsxWidget()];

            builder.buildJsxNamespace(sourceFile, widgets);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("declare global");
        });

        it("creates React.JSX namespace", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [createJsxWidget()];

            builder.buildJsxNamespace(sourceFile, widgets);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("namespace React");
            expect(code).toContain("namespace JSX");
        });

        it("creates IntrinsicElements interface", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [createJsxWidget()];

            builder.buildJsxNamespace(sourceFile, widgets);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("interface IntrinsicElements");
        });

        it("maps widget jsxName to props type", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [createJsxWidget({ jsxName: "GtkButton" })];

            builder.buildJsxNamespace(sourceFile, widgets);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("GtkButton: GtkButtonProps");
        });

        it("includes multiple widgets in IntrinsicElements", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [
                createJsxWidget({ className: "Button", jsxName: "GtkButton" }),
                createJsxWidget({ className: "Label", jsxName: "GtkLabel" }),
            ];

            builder.buildJsxNamespace(sourceFile, widgets);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("GtkButton: GtkButtonProps");
            expect(code).toContain("GtkLabel: GtkLabelProps");
        });

        it("excludes Widget class from IntrinsicElements", () => {
            const widgetMeta = createWidgetMeta();
            const { sourceFile, builder } = createTestSetup();
            const widgets = [
                {
                    className: "Widget",
                    jsxName: "GtkWidget",
                    namespace: "Gtk",
                    isListWidget: false,
                    isDropDownWidget: false,
                    isColumnViewWidget: false,
                    isContainer: true,
                    slots: [],
                    hiddenProps: new Set<string>(),
                    meta: widgetMeta,
                } as JsxWidget,
                createJsxWidget({ className: "Button", jsxName: "GtkButton" }),
            ];

            builder.buildJsxNamespace(sourceFile, widgets);

            const code = getGeneratedCode(sourceFile);
            expect(code).not.toContain("GtkWidget: GtkWidgetProps");
            expect(code).toContain("GtkButton: GtkButtonProps");
        });
    });

    describe("buildWidgetSlotNamesType", () => {
        it("creates WidgetSlotNames type alias when no widgets have slots", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [createJsxWidget({ slots: [] })];

            builder.buildWidgetSlotNamesType(sourceFile, widgets);

            const typeAlias = sourceFile.getTypeAlias("WidgetSlotNames");
            expect(typeAlias).toBeDefined();
            expect(typeAlias?.getTypeNode()?.getText()).toBe("Record<string, never>");
        });

        it("creates WidgetSlotNames interface when widgets have slots", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [createJsxWidget({ jsxName: "GtkBox", slots: ["start", "end"] })];

            builder.buildWidgetSlotNamesType(sourceFile, widgets);

            const iface = sourceFile.getInterface("WidgetSlotNames");
            expect(iface).toBeDefined();
        });

        it("maps widget to slot names union", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [createJsxWidget({ jsxName: "GtkBox", slots: ["start", "end"] })];

            builder.buildWidgetSlotNamesType(sourceFile, widgets);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain('GtkBox: "start" | "end"');
        });

        it("converts slot names to camelCase", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [createJsxWidget({ jsxName: "GtkWindow", slots: ["title-widget", "default-widget"] })];

            builder.buildWidgetSlotNamesType(sourceFile, widgets);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain('"titleWidget"');
            expect(code).toContain('"defaultWidget"');
        });

        it("excludes widgets with no slots from interface", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [
                createJsxWidget({ jsxName: "GtkBox", slots: ["start"] }),
                createJsxWidget({ jsxName: "GtkLabel", slots: [] }),
            ];

            builder.buildWidgetSlotNamesType(sourceFile, widgets);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("GtkBox");
            expect(code).not.toContain("GtkLabel");
        });

        it("exports WidgetSlotNames", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [createJsxWidget({ slots: [] })];

            builder.buildWidgetSlotNamesType(sourceFile, widgets);

            const typeAlias = sourceFile.getTypeAlias("WidgetSlotNames");
            expect(typeAlias?.isExported()).toBe(true);
        });

        it("includes documentation for WidgetSlotNames", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [createJsxWidget({ jsxName: "GtkBox", slots: ["start"] })];

            builder.buildWidgetSlotNamesType(sourceFile, widgets);

            const iface = sourceFile.getInterface("WidgetSlotNames");
            const jsDocs = iface?.getJsDocs() ?? [];
            expect(jsDocs.length).toBeGreaterThan(0);
            expect(jsDocs[0].getDescription()).toContain("slot names");
        });

        it("exports WidgetSlotNames interface when widgets have slots", () => {
            const { sourceFile, builder } = createTestSetup();
            const widgets = [createJsxWidget({ jsxName: "GtkBox", slots: ["start"] })];

            builder.buildWidgetSlotNamesType(sourceFile, widgets);

            const iface = sourceFile.getInterface("WidgetSlotNames");
            expect(iface?.isExported()).toBe(true);
        });
    });

    describe("addModuleExport", () => {
        it("adds empty export declaration", () => {
            const { sourceFile, builder } = createTestSetup();

            builder.addModuleExport(sourceFile);

            const exports = sourceFile.getExportDeclarations();
            expect(exports).toHaveLength(1);
        });

        it("ensures file is treated as module", () => {
            const { sourceFile, builder } = createTestSetup();

            builder.addModuleExport(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toMatch(/export\s*\{\s*\}/);
        });
    });
});
