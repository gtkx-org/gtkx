import { describe, expect, it } from "vitest";
import { fileBuilder, stringify } from "../../../../src/builders/index.js";
import type { JsxWidget } from "../../../../src/react/generators/jsx-types/generator.js";
import { IntrinsicElementsBuilder } from "../../../../src/react/generators/jsx-types/intrinsic-elements-builder.js";
import { createButtonMeta, createWidgetMeta } from "../../../fixtures/metadata-fixtures.js";

function createJsxWidget(overrides: Partial<JsxWidget> = {}): JsxWidget {
    const meta = createButtonMeta();
    return {
        className: "Button",
        jsxName: "GtkButton",
        namespace: "Gtk",
        slots: [],
        hiddenProps: new Set(),
        meta,
        ...overrides,
    };
}

function createTestSetup() {
    const file = fileBuilder();
    const builder = new IntrinsicElementsBuilder();
    return { file, builder };
}

describe("IntrinsicElementsBuilder / constructor", () => {
    it("creates builder instance", () => {
        const builder = new IntrinsicElementsBuilder();
        expect(builder).toBeInstanceOf(IntrinsicElementsBuilder);
    });
});

describe("IntrinsicElementsBuilder / buildWidgetExports", () => {
    it("creates const exports for each widget", () => {
        const { file, builder } = createTestSetup();
        const widgets = [createJsxWidget({ jsxName: "GtkButton" }), createJsxWidget({ jsxName: "GtkLabel" })];

        builder.buildWidgetExports(file, widgets);

        const code = stringify(file);
        expect(code).toContain('export const GtkButton = "GtkButton" as const');
        expect(code).toContain('export const GtkLabel = "GtkLabel" as const');
    });

    it("creates exported const declarations", () => {
        const { file, builder } = createTestSetup();
        const widgets = [createJsxWidget({ jsxName: "GtkButton" })];

        builder.buildWidgetExports(file, widgets);

        const code = stringify(file);
        expect(code).toContain("export const GtkButton");
    });

    it("handles empty widget list", () => {
        const { file, builder } = createTestSetup();

        builder.buildWidgetExports(file, []);

        const code = stringify(file);
        expect(code).toBe("");
    });
});

describe("IntrinsicElementsBuilder / buildJsxNamespace (1)", () => {
    it("creates global declare module", () => {
        const { file, builder } = createTestSetup();
        const widgets = [createJsxWidget()];

        builder.buildJsxNamespace(file, widgets, [], []);

        const code = stringify(file);
        expect(code).toContain("declare global");
    });

    it("creates React.JSX namespace", () => {
        const { file, builder } = createTestSetup();
        const widgets = [createJsxWidget()];

        builder.buildJsxNamespace(file, widgets, [], []);

        const code = stringify(file);
        expect(code).toContain("namespace React");
        expect(code).toContain("namespace JSX");
    });

    it("creates IntrinsicElements interface", () => {
        const { file, builder } = createTestSetup();
        const widgets = [createJsxWidget()];

        builder.buildJsxNamespace(file, widgets, [], []);

        const code = stringify(file);
        expect(code).toContain("interface IntrinsicElements");
    });

    it("maps widget jsxName to props type", () => {
        const { file, builder } = createTestSetup();
        const widgets = [createJsxWidget({ jsxName: "GtkButton" })];

        builder.buildJsxNamespace(file, widgets, [], []);

        const code = stringify(file);
        expect(code).toContain("GtkButton: GtkButtonProps");
    });
});

describe("IntrinsicElementsBuilder / buildJsxNamespace (2)", () => {
    it("includes multiple widgets in IntrinsicElements", () => {
        const { file, builder } = createTestSetup();
        const widgets = [
            createJsxWidget({ className: "Button", jsxName: "GtkButton" }),
            createJsxWidget({ className: "Label", jsxName: "GtkLabel" }),
        ];

        builder.buildJsxNamespace(file, widgets, [], []);

        const code = stringify(file);
        expect(code).toContain("GtkButton: GtkButtonProps");
        expect(code).toContain("GtkLabel: GtkLabelProps");
    });

    it("excludes Widget class from IntrinsicElements", () => {
        const widgetMeta = createWidgetMeta();
        const { file, builder } = createTestSetup();
        const widgets = [
            {
                className: "Widget",
                jsxName: "GtkWidget",
                namespace: "Gtk",
                slots: [],
                hiddenProps: new Set<string>(),
                meta: widgetMeta,
            } as JsxWidget,
            createJsxWidget({ className: "Button", jsxName: "GtkButton" }),
        ];

        builder.buildJsxNamespace(file, widgets, [], []);

        const code = stringify(file);
        expect(code).not.toContain("GtkWidget: GtkWidgetProps");
        expect(code).toContain("GtkButton: GtkButtonProps");
    });
});

describe("IntrinsicElementsBuilder / buildWidgetSlotNamesType (1)", () => {
    it("creates WidgetSlotNames type alias when no widgets have slots", () => {
        const { file, builder } = createTestSetup();
        const widgets = [createJsxWidget({ slots: [] })];

        builder.buildWidgetSlotNamesType(file, widgets);

        const code = stringify(file);
        expect(code).toContain("WidgetSlotNames");
        expect(code).toContain("Record<string, never>");
    });

    it("creates WidgetSlotNames type alias when widgets have slots", () => {
        const { file, builder } = createTestSetup();
        const widgets = [createJsxWidget({ jsxName: "GtkBox", slots: ["start", "end"] })];

        builder.buildWidgetSlotNamesType(file, widgets);

        const code = stringify(file);
        expect(code).toContain("WidgetSlotNames");
    });

    it("maps widget to slot names union", () => {
        const { file, builder } = createTestSetup();
        const widgets = [createJsxWidget({ jsxName: "GtkBox", slots: ["start", "end"] })];

        builder.buildWidgetSlotNamesType(file, widgets);

        const code = stringify(file);
        expect(code).toContain('GtkBox: "start" | "end"');
    });

    it("converts slot names to camelCase", () => {
        const { file, builder } = createTestSetup();
        const widgets = [createJsxWidget({ jsxName: "GtkWindow", slots: ["title-widget", "default-widget"] })];

        builder.buildWidgetSlotNamesType(file, widgets);

        const code = stringify(file);
        expect(code).toContain('"titleWidget"');
        expect(code).toContain('"defaultWidget"');
    });
});

describe("IntrinsicElementsBuilder / buildWidgetSlotNamesType (2)", () => {
    it("excludes widgets with no slots from interface", () => {
        const { file, builder } = createTestSetup();
        const widgets = [
            createJsxWidget({ jsxName: "GtkBox", slots: ["start"] }),
            createJsxWidget({ jsxName: "GtkLabel", slots: [] }),
        ];

        builder.buildWidgetSlotNamesType(file, widgets);

        const code = stringify(file);
        expect(code).toContain("GtkBox");
        expect(code).not.toContain("GtkLabel");
    });

    it("exports WidgetSlotNames", () => {
        const { file, builder } = createTestSetup();
        const widgets = [createJsxWidget({ slots: [] })];

        builder.buildWidgetSlotNamesType(file, widgets);

        const code = stringify(file);
        expect(code).toContain("export type WidgetSlotNames");
    });

    it("includes documentation for WidgetSlotNames", () => {
        const { file, builder } = createTestSetup();
        const widgets = [createJsxWidget({ jsxName: "GtkBox", slots: ["start"] })];

        builder.buildWidgetSlotNamesType(file, widgets);

        const code = stringify(file);
        expect(code).toContain("slot names");
    });

    it("exports WidgetSlotNames type alias when widgets have slots", () => {
        const { file, builder } = createTestSetup();
        const widgets = [createJsxWidget({ jsxName: "GtkBox", slots: ["start"] })];

        builder.buildWidgetSlotNamesType(file, widgets);

        const code = stringify(file);
        expect(code).toContain("export type WidgetSlotNames");
    });
});

describe("IntrinsicElementsBuilder / addModuleExport", () => {
    it("adds empty export declaration", () => {
        const { file, builder } = createTestSetup();

        builder.addModuleExport(file);

        const code = stringify(file);
        expect(code).toContain("export {}");
    });

    it("ensures file is treated as module", () => {
        const { file, builder } = createTestSetup();

        builder.addModuleExport(file);

        const code = stringify(file);
        expect(code).toMatch(/export\s*\{\s*\}/);
    });
});
