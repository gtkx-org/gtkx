import { describe, expect, it } from "vitest";
import { fileBuilder, stringify } from "../../../src/builders/index.js";
import { InternalGenerator } from "../../../src/react/generators/internal.js";
import { MetadataReader } from "../../../src/react/metadata-reader.js";
import {
    createButtonMeta,
    createCodegenWidgetMeta,
    createSignalAnalysis,
    createWidgetMeta,
} from "../../fixtures/metadata-fixtures.js";

function generateCode(metas = [createWidgetMeta(), createButtonMeta()]): string {
    const reader = new MetadataReader(metas);
    const generator = new InternalGenerator(reader, []);
    const file = fileBuilder();
    generator.generate(file);
    return stringify(file);
}

describe("InternalGenerator / constructor", () => {
    it("creates generator with reader and controllers", () => {
        const reader = new MetadataReader([createWidgetMeta()]);
        const generator = new InternalGenerator(reader, []);
        expect(generator).toBeInstanceOf(InternalGenerator);
    });
});

describe("InternalGenerator / generate", () => {
    it("produces non-empty output", () => {
        const code = generateCode();
        expect(code.length).toBeGreaterThan(0);
    });

    it("adds file comment about internal metadata", () => {
        const code = generateCode();
        expect(code).toContain("Internal metadata for the reconciler");
    });
});

describe("InternalGenerator / FFI namespace imports", () => {
    it("side-effect-imports every namespace that contributes a reconcilable element", () => {
        const adwMeta = createCodegenWidgetMeta({ className: "Bin", jsxName: "AdwBin", namespace: "Adw" });
        const code = generateCode([createWidgetMeta(), adwMeta]);
        expect(code).toContain('import "@gtkx/ffi/adw";');
        expect(code).toContain('import "@gtkx/ffi/gtk";');
        expect(code).not.toContain("import * as Adw");
        expect(code).not.toContain("import * as Gtk");
    });
});

describe("InternalGenerator / low-level FFI imports", () => {
    it("does not import the FFI descriptor builder or Type", () => {
        const code = generateCode();
        expect(code).not.toContain('import { t } from "@gtkx/ffi"');
        expect(code).not.toContain("import type { Type }");
    });

    it("does not emit a CONSTRUCTION_META map", () => {
        const code = generateCode();
        expect(code).not.toContain("CONSTRUCTION_META");
    });
});

describe("InternalGenerator / PROPS map", () => {
    it("generates PROPS constant", () => {
        const code = generateCode();
        expect(code).toContain("PROPS");
    });

    it("has correct type annotation for PROPS", () => {
        const code = generateCode();
        expect(code).toContain("Record<string, Record<string, string>>");
    });
});

describe("InternalGenerator / SIGNALS map", () => {
    it("generates SIGNALS constant", () => {
        const code = generateCode();
        expect(code).toContain("SIGNALS");
    });

    it("includes signal names for widgets with signals", () => {
        const buttonMeta = createButtonMeta({
            signalNames: ["clicked", "activate"],
        });
        const code = generateCode([createWidgetMeta(), buttonMeta]);
        expect(code).toContain("clicked");
        expect(code).toContain("activate");
    });

    it("excludes widgets without signals from SIGNALS map", () => {
        const labelMeta = createCodegenWidgetMeta({
            className: "Label",
            jsxName: "GtkLabel",
            signalNames: [],
            signals: [],
        });
        const widgetMeta = createWidgetMeta();
        const code = generateCode([widgetMeta, labelMeta]);
        const signalsStart = code.indexOf("SIGNALS");
        const signalsEnd = code.indexOf("CONSTRUCT_ONLY", signalsStart);
        const signalsSection = code.slice(signalsStart, signalsEnd);
        expect(signalsSection).toContain("GtkWidget");
        expect(signalsSection).not.toContain("GtkLabel");
    });

    it("has Record<string, Record<string, string>> type annotation", () => {
        const code = generateCode();
        expect(code).toContain("Record<string, Record<string, string>>");
    });
});

describe("InternalGenerator / widget sorting", () => {
    it("sorts Widget first within SIGNALS map", () => {
        const labelMeta = createCodegenWidgetMeta({
            className: "Label",
            jsxName: "GtkLabel",
            signalNames: ["activate"],
            signals: [createSignalAnalysis({ name: "activate", camelName: "activate", handlerName: "onActivate" })],
        });
        const buttonMeta = createButtonMeta();
        const widgetMeta = createWidgetMeta();
        const code = generateCode([labelMeta, buttonMeta, widgetMeta]);

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

describe("InternalGenerator / export statements", () => {
    it("exports PROPS", () => {
        const code = generateCode();
        expect(code).toContain("export const PROPS");
    });

    it("exports SIGNALS", () => {
        const code = generateCode();
        expect(code).toContain("export const SIGNALS");
    });
});
