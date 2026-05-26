import { describe, expect, it } from "vitest";
import { fileBuilder, stringify } from "../../../../src/builders/index.js";
import { JsxTypesGenerator } from "../../../../src/react/generators/jsx-types/generator.js";
import { MetadataReader } from "../../../../src/react/metadata-reader.js";
import {
    createButtonMeta,
    createCodegenWidgetMeta,
    createPropertyAnalysis,
    createSignalAnalysis,
    createWidgetMeta,
} from "../../../fixtures/metadata-fixtures.js";

function createTestSetup(metas = [createWidgetMeta(), createButtonMeta()], namespaceNames = ["Gtk"]) {
    const reader = new MetadataReader(metas);
    const generator = new JsxTypesGenerator(reader, [], [], namespaceNames);
    return { reader, generator };
}

function generateCode(metas = [createWidgetMeta(), createButtonMeta()], namespaceNames = ["Gtk"]): string {
    const { generator } = createTestSetup(metas, namespaceNames);
    const file = fileBuilder();
    generator.generate(file);
    return stringify(file);
}

describe("JsxTypesGenerator / constructor", () => {
    it("creates generator with dependencies", () => {
        const { generator } = createTestSetup();
        expect(generator).toBeInstanceOf(JsxTypesGenerator);
    });
});

describe("JsxTypesGenerator / generate", () => {
    it("produces non-empty output", () => {
        const code = generateCode();
        expect(code.length).toBeGreaterThan(0);
    });
});

describe("JsxTypesGenerator / imports", () => {
    it("imports ReactNode and Ref from react", () => {
        const code = generateCode();
        expect(code).toContain("ReactNode");
        expect(code).toContain("Ref");
        expect(code).toContain("react");
    });

    it("adds namespace imports for used namespaces", () => {
        const code = generateCode();
        expect(code).toContain("* as Gtk");
    });
});

describe("JsxTypesGenerator / WidgetProps interface", () => {
    it("generates WidgetProps interface", () => {
        const code = generateCode([createWidgetMeta()]);
        expect(code).toContain("interface WidgetProps");
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
        const code = generateCode([widgetMeta]);
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
        const code = generateCode([widgetMeta]);
        expect(code).toContain("onDestroy");
    });

    it("exports WidgetProps", () => {
        const code = generateCode([createWidgetMeta()]);
        expect(code).toContain("export interface WidgetProps");
    });
});

describe("JsxTypesGenerator / widget-specific props interfaces", () => {
    it("generates props interface for each widget", () => {
        const code = generateCode([createWidgetMeta(), createButtonMeta()]);
        expect(code).toContain("GtkButtonProps");
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
        const code = generateCode([createWidgetMeta(), buttonMeta]);
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
        const code = generateCode([createWidgetMeta(), buttonMeta]);
        expect(code).toContain("onClicked");
    });

    it("includes onNotify callback", () => {
        const code = generateCode([createWidgetMeta(), createButtonMeta()]);
        expect(code).toContain("onNotify");
    });

    it("includes ref property", () => {
        const code = generateCode([createWidgetMeta(), createButtonMeta()]);
        expect(code).toContain("ref");
        expect(code).toContain("Ref<");
    });
});

describe("JsxTypesGenerator / cross-namespace widgets", () => {
    it("includes cross-namespace widgets when namespace is specified", () => {
        const adwHeaderBarMeta = createCodegenWidgetMeta({
            className: "HeaderBar",
            jsxName: "AdwHeaderBar",
            namespace: "Adw",
        });
        const code = generateCode([createWidgetMeta(), adwHeaderBarMeta], ["Gtk", "Adw"]);
        expect(code).toContain("AdwHeaderBarProps");
    });

    it("filters out widgets from namespaces not in list", () => {
        const adwHeaderBarMeta = createCodegenWidgetMeta({
            className: "HeaderBar",
            jsxName: "AdwHeaderBar",
            namespace: "Adw",
        });
        const code = generateCode([createWidgetMeta(), adwHeaderBarMeta], ["Gtk"]);
        expect(code).not.toContain("AdwHeaderBarProps");
    });
});

describe("JsxTypesGenerator / widget sorting", () => {
    it("generates Widget props first", () => {
        const labelMeta = createCodegenWidgetMeta({
            className: "Label",
            jsxName: "GtkLabel",
        });
        const buttonMeta = createButtonMeta();
        const code = generateCode([labelMeta, buttonMeta, createWidgetMeta()]);

        const widgetPropsIndex = code.indexOf("WidgetProps");
        const buttonPropsIndex = code.indexOf("GtkButtonProps");

        expect(widgetPropsIndex).toBeLessThan(buttonPropsIndex);
    });
});

describe("JsxTypesGenerator / JSX namespace and module", () => {
    it("generates JSX namespace", () => {
        const code = generateCode([createWidgetMeta()]);
        expect(code).toContain("namespace JSX");
    });

    it("generates IntrinsicElements interface", () => {
        const code = generateCode([createWidgetMeta()]);
        expect(code).toContain("IntrinsicElements");
    });

    it("includes widget entries in IntrinsicElements", () => {
        const code = generateCode([createWidgetMeta(), createButtonMeta()]);
        expect(code).toContain("GtkButton");
    });
});

describe("JsxTypesGenerator / slot name type", () => {
    it("generates WidgetSlotNames type", () => {
        const boxMeta = createCodegenWidgetMeta({
            className: "Box",
            jsxName: "GtkBox",
            slots: ["start", "end"],
        });
        const code = generateCode([createWidgetMeta(), boxMeta]);
        expect(code).toContain("WidgetSlotNames");
    });
});
