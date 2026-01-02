import { describe, expect, it } from "vitest";
import { CodegenProject } from "../../../src/core/project.js";
import { InternalGenerator } from "../../../src/react/generators/internal.js";
import { MetadataReader } from "../../../src/react/metadata-reader.js";
import { createButtonMeta, createCodegenWidgetMeta, createWidgetMeta } from "../../fixtures/metadata-fixtures.js";

function createTestSetup(metas = [createWidgetMeta(), createButtonMeta()]) {
    const reader = new MetadataReader(metas);
    const project = new CodegenProject();
    const generator = new InternalGenerator(reader, project);
    return { reader, project, generator };
}

describe("InternalGenerator", () => {
    describe("constructor", () => {
        it("creates generator with reader and project", () => {
            const { generator } = createTestSetup();
            expect(generator).toBeInstanceOf(InternalGenerator);
        });
    });

    describe("generate", () => {
        it("creates internal.ts file in react directory", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            expect(sourceFile).not.toBeNull();
        });

        it("returns the created source file", () => {
            const { generator } = createTestSetup();

            const sourceFile = generator.generate();

            expect(sourceFile).toBeDefined();
            expect(sourceFile.getFilePath()).toContain("internal.ts");
        });

        it("adds file comment about single source of truth", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("SINGLE SOURCE OF TRUTH");
        });
    });

    describe("classification constants", () => {
        it("generates LIST_WIDGET_CLASSES constant", () => {
            const listViewMeta = createCodegenWidgetMeta({
                className: "ListView",
                jsxName: "GtkListView",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), listViewMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("LIST_WIDGET_CLASSES");
            expect(code).toContain("Gtk.ListView");
        });

        it("generates DROP_DOWN_CLASSES constant", () => {
            const dropDownMeta = createCodegenWidgetMeta({
                className: "DropDown",
                jsxName: "GtkDropDown",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), dropDownMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("DROP_DOWN_CLASSES");
            expect(code).toContain("Gtk.DropDown");
        });

        it("generates COLUMN_VIEW_CLASSES constant", () => {
            const columnViewMeta = createCodegenWidgetMeta({
                className: "ColumnView",
                jsxName: "GtkColumnView",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), columnViewMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("COLUMN_VIEW_CLASSES");
            expect(code).toContain("Gtk.ColumnView");
        });

        it("generates AUTOWRAP_CLASSES constant", () => {
            const listBoxMeta = createCodegenWidgetMeta({
                className: "ListBox",
                jsxName: "GtkListBox",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), listBoxMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("AUTOWRAP_CLASSES");
            expect(code).toContain("Gtk.ListBox");
        });

        it("generates STACK_CLASSES constant", () => {
            const stackMeta = createCodegenWidgetMeta({
                className: "Stack",
                jsxName: "GtkStack",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), stackMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("STACK_CLASSES");
            expect(code).toContain("Gtk.Stack");
        });

        it("generates NOTEBOOK_CLASSES constant", () => {
            const notebookMeta = createCodegenWidgetMeta({
                className: "Notebook",
                jsxName: "GtkNotebook",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), notebookMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("NOTEBOOK_CLASSES");
            expect(code).toContain("Gtk.Notebook");
        });

        it("generates POPOVER_MENU_CLASSES constant", () => {
            const popoverMenuMeta = createCodegenWidgetMeta({
                className: "PopoverMenu",
                jsxName: "GtkPopoverMenu",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), popoverMenuMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("POPOVER_MENU_CLASSES");
            expect(code).toContain("Gtk.PopoverMenu");
        });

        it("generates empty classification arrays when no matching widgets", () => {
            const { project, generator } = createTestSetup([createWidgetMeta()]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("LIST_WIDGET_CLASSES");
        });
    });

    describe("interface method constants", () => {
        it("generates PACK_INTERFACE_METHODS constant", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("PACK_INTERFACE_METHODS");
        });

        it("generates PREFIX_SUFFIX_INTERFACE_METHODS constant", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("PREFIX_SUFFIX_INTERFACE_METHODS");
        });
    });

    describe("CONSTRUCTOR_PROPS", () => {
        it("generates CONSTRUCTOR_PROPS constant", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("CONSTRUCTOR_PROPS");
        });

        it("includes constructor params for widgets with params", () => {
            const buttonMeta = createButtonMeta({
                constructorParams: ["label", "iconName"],
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), buttonMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("GtkButton");
            expect(code).toContain("label");
            expect(code).toContain("iconName");
        });

        it("excludes widgets without constructor params from CONSTRUCTOR_PROPS", () => {
            const buttonMeta = createButtonMeta({
                constructorParams: [],
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), buttonMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("CONSTRUCTOR_PROPS");
            const constructorPropsStart = code.indexOf("CONSTRUCTOR_PROPS");
            const nextExport = code.indexOf("export const", constructorPropsStart + 1);
            const constructorPropsSection = code.slice(constructorPropsStart, nextExport);
            expect(constructorPropsSection).not.toContain("GtkButton");
        });

        it("has Record<string, string[]> type annotation", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("Record<string, string[]>");
        });
    });

    describe("PROPS map", () => {
        it("generates PROPS constant", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("PROPS");
        });

        it("has correct type annotation for PROPS", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("Record<string, Record<string, [string | null, string]>>");
        });
    });

    describe("SIGNALS map", () => {
        it("generates SIGNALS constant", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("SIGNALS");
        });

        it("includes signal names for widgets with signals", () => {
            const buttonMeta = createButtonMeta({
                signalNames: ["clicked", "activate"],
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), buttonMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("clicked");
            expect(code).toContain("activate");
        });

        it("excludes widgets without signals from SIGNALS map", () => {
            const labelMeta = createCodegenWidgetMeta({
                className: "Label",
                jsxName: "GtkLabel",
                signalNames: [],
            });
            const widgetMeta = createWidgetMeta({ signalNames: ["destroy"] });
            const { project, generator } = createTestSetup([widgetMeta, labelMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            const signalsStart = code.indexOf("SIGNALS");
            const signalsSection = code.slice(signalsStart);
            expect(signalsSection).toContain("GtkWidget");
            expect(signalsSection).not.toContain("GtkLabel");
        });

        it("has Record<string, Set<string>> type annotation", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("Record<string, Set<string>>");
        });
    });

    describe("namespace imports", () => {
        it("adds imports for used namespaces", () => {
            const listViewMeta = createCodegenWidgetMeta({
                className: "ListView",
                jsxName: "GtkListView",
                namespace: "Gtk",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), listViewMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const imports = sourceFile?.getImportDeclarations() ?? [];
            const namespaces = imports.map((i) => i.getNamespaceImport()?.getText()).filter(Boolean);
            expect(namespaces).toContain("Gtk");
        });

        it("includes cross-namespace imports when needed", () => {
            const adwBannerMeta = createCodegenWidgetMeta({
                className: "Banner",
                jsxName: "AdwBanner",
                namespace: "Adw",
            });
            const flowBoxMeta = createCodegenWidgetMeta({
                className: "FlowBox",
                jsxName: "GtkFlowBox",
                namespace: "Gtk",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), adwBannerMeta, flowBoxMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const imports = sourceFile?.getImportDeclarations() ?? [];
            const namespaces = imports.map((i) => i.getNamespaceImport()?.getText()).filter(Boolean);
            expect(namespaces).toContain("Gtk");
        });
    });

    describe("widget sorting", () => {
        it("sorts Widget first within SIGNALS map", () => {
            const labelMeta = createCodegenWidgetMeta({
                className: "Label",
                jsxName: "GtkLabel",
                signalNames: ["activate"],
            });
            const buttonMeta = createButtonMeta({
                signalNames: ["clicked"],
            });
            const widgetMeta = createWidgetMeta({
                signalNames: ["destroy"],
            });
            const { project, generator } = createTestSetup([labelMeta, buttonMeta, widgetMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            const signalsIndex = code.indexOf("SIGNALS");
            const signalsSection = code.slice(signalsIndex);

            const widgetIndex = signalsSection.indexOf("GtkWidget");
            const buttonIndex = signalsSection.indexOf("GtkButton");
            const labelIndex = signalsSection.indexOf("GtkLabel");

            expect(widgetIndex).not.toBe(-1);
            expect(buttonIndex).not.toBe(-1);
            expect(labelIndex).not.toBe(-1);
            expect(widgetIndex).toBeLessThan(buttonIndex);
            expect(widgetIndex).toBeLessThan(labelIndex);
        });
    });

    describe("export statements", () => {
        it("exports all classification constants", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("export const LIST_WIDGET_CLASSES");
            expect(code).toContain("export const DROP_DOWN_CLASSES");
            expect(code).toContain("export const COLUMN_VIEW_CLASSES");
            expect(code).toContain("export const AUTOWRAP_CLASSES");
            expect(code).toContain("export const STACK_CLASSES");
            expect(code).toContain("export const NOTEBOOK_CLASSES");
            expect(code).toContain("export const POPOVER_MENU_CLASSES");
        });

        it("exports CONSTRUCTOR_PROPS", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("export const CONSTRUCTOR_PROPS");
        });

        it("exports PROPS", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("export const PROPS");
        });

        it("exports SIGNALS", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/internal.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("export const SIGNALS");
        });
    });
});
