import { describe, expect, it } from "vitest";
import { CodegenProject } from "../../../../src/core/project.js";
import { FfiAstAnalyzer } from "../../../../src/react/analyzers/ffi-ast-analyzer.js";
import { JsxTypesGenerator } from "../../../../src/react/generators/jsx-types/generator.js";
import { MetadataReader } from "../../../../src/react/metadata-reader.js";
import {
    createButtonMeta,
    createCodegenWidgetMeta,
    createPropertyAnalysis,
    createSignalAnalysis,
    createWidgetMeta,
} from "../../../fixtures/metadata-fixtures.js";
import { createFfiProjectWithWidgets, type FfiWidgetConfig } from "../../../fixtures/ts-morph-helpers.js";

function createTestSetup(
    metas = [createWidgetMeta(), createButtonMeta()],
    ffiWidgets: FfiWidgetConfig[] = [],
    namespaceNames = ["Gtk"],
) {
    const reader = new MetadataReader(metas);
    const ffiProject = createFfiProjectWithWidgets(ffiWidgets);
    const ffiAnalyzer = new FfiAstAnalyzer(ffiProject);
    const project = new CodegenProject();
    const generator = new JsxTypesGenerator(reader, ffiAnalyzer, project, namespaceNames);
    return { reader, ffiProject, ffiAnalyzer, project, generator };
}

describe("JsxTypesGenerator", () => {
    describe("constructor", () => {
        it("creates generator with dependencies", () => {
            const { generator } = createTestSetup();
            expect(generator).toBeInstanceOf(JsxTypesGenerator);
        });
    });

    describe("generate", () => {
        it("creates jsx.ts file in react directory", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            expect(sourceFile).not.toBeNull();
        });
    });

    describe("imports", () => {
        it("imports ReactNode and Ref from react", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const imports = sourceFile?.getImportDeclarations() ?? [];
            const reactImport = imports.find((i) => i.getModuleSpecifierValue() === "react");
            expect(reactImport).toBeDefined();
            expect(reactImport?.isTypeOnly()).toBe(true);
        });

        it("adds namespace imports for used namespaces", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const imports = sourceFile?.getImportDeclarations() ?? [];
            const namespaces = imports.map((i) => i.getNamespaceImport()?.getText()).filter(Boolean);
            expect(namespaces).toContain("Gtk");
        });
    });

    describe("WidgetNotifyProps type", () => {
        it("generates WidgetNotifyProps type alias", () => {
            const widgetMeta = createWidgetMeta({
                propNames: ["visible", "can-focus", "sensitive"],
            });
            const { project, generator } = createTestSetup([widgetMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const typeAlias = sourceFile?.getTypeAlias("WidgetNotifyProps");
            expect(typeAlias).toBeDefined();
        });

        it("includes all widget prop names in union", () => {
            const widgetMeta = createWidgetMeta({
                propNames: ["visible", "can-focus", "sensitive"],
            });
            const { project, generator } = createTestSetup([widgetMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain('"visible"');
            expect(code).toContain('"can-focus"');
            expect(code).toContain('"sensitive"');
        });

        it("exports WidgetNotifyProps", () => {
            const { project, generator } = createTestSetup([createWidgetMeta()]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const typeAlias = sourceFile?.getTypeAlias("WidgetNotifyProps");
            expect(typeAlias?.isExported()).toBe(true);
        });
    });

    describe("WidgetProps interface", () => {
        it("generates WidgetProps interface", () => {
            const { project, generator } = createTestSetup([createWidgetMeta()]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const iface = sourceFile?.getInterface("WidgetProps");
            expect(iface).toBeDefined();
        });

        it("includes properties from Widget metadata", () => {
            const widgetMeta = createWidgetMeta({
                properties: [
                    createPropertyAnalysis({
                        name: "visible",
                        camelName: "visible",
                        type: "boolean",
                        isWritable: true,
                    }),
                ],
            });
            const { project, generator } = createTestSetup([widgetMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("visible");
        });

        it("includes signals from Widget metadata", () => {
            const widgetMeta = createWidgetMeta({
                signals: [
                    createSignalAnalysis({
                        name: "destroy",
                        handlerName: "onDestroy",
                    }),
                ],
            });
            const { project, generator } = createTestSetup([widgetMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("onDestroy");
        });

        it("exports WidgetProps", () => {
            const { project, generator } = createTestSetup([createWidgetMeta()]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const iface = sourceFile?.getInterface("WidgetProps");
            expect(iface?.isExported()).toBe(true);
        });
    });

    describe("widget-specific props interfaces", () => {
        it("generates props interface for each widget", () => {
            const buttonMeta = createButtonMeta();
            const { project, generator } = createTestSetup([createWidgetMeta(), buttonMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const iface = sourceFile?.getInterface("GtkButtonProps");
            expect(iface).toBeDefined();
        });

        it("includes widget-specific properties", () => {
            const buttonMeta = createButtonMeta({
                properties: [
                    createPropertyAnalysis({
                        name: "label",
                        camelName: "label",
                        type: "string",
                        isWritable: true,
                    }),
                ],
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), buttonMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("label");
        });

        it("includes widget-specific signals", () => {
            const buttonMeta = createButtonMeta({
                signals: [
                    createSignalAnalysis({
                        name: "clicked",
                        handlerName: "onClicked",
                    }),
                ],
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), buttonMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("onClicked");
        });

        it("includes onNotify callback", () => {
            const { project, generator } = createTestSetup([createWidgetMeta(), createButtonMeta()]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("onNotify");
        });

        it("includes ref property", () => {
            const { project, generator } = createTestSetup([createWidgetMeta(), createButtonMeta()]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("ref");
            expect(code).toContain("Ref<");
        });
    });

    describe("list widgets", () => {
        it("adds renderItem property for list widgets", () => {
            const listViewMeta = createCodegenWidgetMeta({
                className: "ListView",
                jsxName: "GtkListView",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), listViewMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("renderItem");
        });

        it("adds selected property for list widgets", () => {
            const listViewMeta = createCodegenWidgetMeta({
                className: "ListView",
                jsxName: "GtkListView",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), listViewMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("selected");
        });

        it("adds onSelectionChanged for list widgets", () => {
            const listViewMeta = createCodegenWidgetMeta({
                className: "ListView",
                jsxName: "GtkListView",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), listViewMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("onSelectionChanged");
        });
    });

    describe("dropdown widgets", () => {
        it("adds selectedId property for dropdown widgets", () => {
            const dropDownMeta = createCodegenWidgetMeta({
                className: "DropDown",
                jsxName: "GtkDropDown",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), dropDownMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("selectedId");
        });
    });

    describe("column view widgets", () => {
        it("adds sortColumn property for column view widgets", () => {
            const columnViewMeta = createCodegenWidgetMeta({
                className: "ColumnView",
                jsxName: "GtkColumnView",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), columnViewMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("sortColumn");
        });

        it("adds sortOrder property for column view widgets", () => {
            const columnViewMeta = createCodegenWidgetMeta({
                className: "ColumnView",
                jsxName: "GtkColumnView",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), columnViewMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("sortOrder");
        });

        it("adds onSortChange callback for column view widgets", () => {
            const columnViewMeta = createCodegenWidgetMeta({
                className: "ColumnView",
                jsxName: "GtkColumnView",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), columnViewMeta]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("onSortChange");
        });
    });

    describe("container widgets", () => {
        it("adds children property for container widgets", () => {
            const boxMeta = createCodegenWidgetMeta({
                className: "Box",
                jsxName: "GtkBox",
            });
            const { project, generator } = createTestSetup(
                [createWidgetMeta(), boxMeta],
                [{ namespace: "Gtk", className: "Box", isContainer: true }],
            );

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("children");
        });
    });

    describe("cross-namespace widgets", () => {
        it("includes cross-namespace widgets when namespace is specified", () => {
            const adwHeaderBarMeta = createCodegenWidgetMeta({
                className: "HeaderBar",
                jsxName: "AdwHeaderBar",
                namespace: "Adw",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), adwHeaderBarMeta], [], ["Gtk", "Adw"]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const iface = sourceFile?.getInterface("AdwHeaderBarProps");
            expect(iface).toBeDefined();
        });

        it("filters out widgets from namespaces not in list", () => {
            const adwHeaderBarMeta = createCodegenWidgetMeta({
                className: "HeaderBar",
                jsxName: "AdwHeaderBar",
                namespace: "Adw",
            });
            const { project, generator } = createTestSetup([createWidgetMeta(), adwHeaderBarMeta], [], ["Gtk"]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const iface = sourceFile?.getInterface("AdwHeaderBarProps");
            expect(iface).toBeUndefined();
        });
    });

    describe("widget sorting", () => {
        it("generates Widget props first", () => {
            const labelMeta = createCodegenWidgetMeta({
                className: "Label",
                jsxName: "GtkLabel",
            });
            const buttonMeta = createButtonMeta();
            const { project, generator } = createTestSetup([labelMeta, buttonMeta, createWidgetMeta()]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            const widgetPropsIndex = code.indexOf("WidgetProps");
            const buttonPropsIndex = code.indexOf("GtkButtonProps");

            expect(widgetPropsIndex).toBeLessThan(buttonPropsIndex);
        });
    });

    describe("JSX namespace and module", () => {
        it("generates JSX namespace", () => {
            const { project, generator } = createTestSetup([createWidgetMeta()]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("namespace JSX");
        });

        it("generates IntrinsicElements interface", () => {
            const { project, generator } = createTestSetup([createWidgetMeta()]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("IntrinsicElements");
        });

        it("includes widget entries in IntrinsicElements", () => {
            const { project, generator } = createTestSetup([createWidgetMeta(), createButtonMeta()]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("GtkButton");
        });
    });

    describe("slot name type", () => {
        it("generates WidgetSlotNames type", () => {
            const boxMeta = createCodegenWidgetMeta({
                className: "Box",
                jsxName: "GtkBox",
            });
            const { project, generator } = createTestSetup(
                [createWidgetMeta(), boxMeta],
                [{ namespace: "Gtk", className: "Box", isContainer: true, slots: ["start", "end"] }],
            );

            generator.generate();

            const sourceFile = project.getSourceFile("react/jsx.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("WidgetSlotNames");
        });
    });
});
