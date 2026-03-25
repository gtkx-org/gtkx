import { describe, expect, it } from "vitest";
import { fileBuilder, stringify } from "../../../src/builders/index.js";
import { InternalGenerator } from "../../../src/react/generators/internal.js";
import { MetadataReader } from "../../../src/react/metadata-reader.js";
import {
    createButtonMeta,
    createCodegenWidgetMeta,
    createPropertyAnalysis,
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

describe("InternalGenerator", () => {
    describe("constructor", () => {
        it("creates generator with reader and controllers", () => {
            const reader = new MetadataReader([createWidgetMeta()]);
            const generator = new InternalGenerator(reader, []);
            expect(generator).toBeInstanceOf(InternalGenerator);
        });
    });

    describe("generate", () => {
        it("produces non-empty output", () => {
            const code = generateCode();
            expect(code.length).toBeGreaterThan(0);
        });

        it("adds file comment about internal metadata", () => {
            const code = generateCode();
            expect(code).toContain("Internal metadata for the reconciler");
        });
    });

    describe("CONSTRUCTION_META", () => {
        it("generates CONSTRUCTION_META constant", () => {
            const buttonMeta = createButtonMeta({
                properties: [
                    createPropertyAnalysis({
                        name: "label",
                        camelName: "label",
                        isWritable: true,
                        ffiType: { type: "string", ownership: "borrowed" },
                    }),
                ],
            });
            const code = generateCode([createWidgetMeta(), buttonMeta]);
            expect(code).toContain("CONSTRUCTION_META");
        });

        it("includes writable props with ffiType", () => {
            const buttonMeta = createButtonMeta({
                properties: [
                    createPropertyAnalysis({
                        name: "label",
                        camelName: "label",
                        isWritable: true,
                        ffiType: { type: "string", ownership: "borrowed" },
                    }),
                ],
            });
            const code = generateCode([createWidgetMeta(), buttonMeta]);
            expect(code).toContain("GtkButton");
            expect(code).toContain('"label"');
            expect(code).toContain("girName");
            expect(code).toContain("ffiType");
        });

        it("marks construct-only props with constructOnly flag", () => {
            const buttonMeta = createButtonMeta({
                properties: [
                    createPropertyAnalysis({
                        name: "orientation",
                        camelName: "orientation",
                        isWritable: true,
                        isConstructOnly: true,
                        ffiType: { type: "int32" },
                    }),
                ],
            });
            const code = generateCode([createWidgetMeta(), buttonMeta]);
            expect(code).toContain("constructOnly: true");
        });

        it("excludes non-writable props", () => {
            const buttonMeta = createButtonMeta({
                properties: [
                    createPropertyAnalysis({
                        name: "label",
                        camelName: "label",
                        isWritable: false,
                        ffiType: { type: "string", ownership: "borrowed" },
                    }),
                ],
            });
            const code = generateCode([createWidgetMeta(), buttonMeta]);
            const metaStart = code.indexOf("CONSTRUCTION_META");
            const nextExport = code.indexOf("export const", metaStart + 1);
            const metaSection = code.slice(metaStart, nextExport);
            expect(metaSection).not.toContain("GtkButton");
        });

        it("excludes props without ffiType", () => {
            const buttonMeta = createButtonMeta({
                properties: [
                    createPropertyAnalysis({
                        name: "label",
                        camelName: "label",
                        isWritable: true,
                    }),
                ],
            });
            const code = generateCode([createWidgetMeta(), buttonMeta]);
            const metaStart = code.indexOf("CONSTRUCTION_META");
            const nextExport = code.indexOf("export const", metaStart + 1);
            const metaSection = code.slice(metaStart, nextExport);
            expect(metaSection).not.toContain("GtkButton");
        });

        it("has correct type annotation", () => {
            const code = generateCode();
            expect(code).toContain(
                "Record<string, Record<string, { girName: string; ffiType: Type; constructOnly?: true }>>",
            );
        });
    });

    describe("PROPS map", () => {
        it("generates PROPS constant", () => {
            const code = generateCode();
            expect(code).toContain("PROPS");
        });

        it("has correct type annotation for PROPS", () => {
            const code = generateCode();
            expect(code).toContain("Record<string, Record<string, string>>");
        });
    });

    describe("SIGNALS map", () => {
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
            const signalsSection = code.slice(signalsStart);
            expect(signalsSection).toContain("GtkWidget");
            expect(signalsSection).not.toContain("GtkLabel");
        });

        it("has Record<string, Record<string, string>> type annotation", () => {
            const code = generateCode();
            expect(code).toContain("Record<string, Record<string, string>>");
        });
    });

    describe("widget sorting", () => {
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

    describe("export statements", () => {
        it("exports CONSTRUCTION_META", () => {
            const code = generateCode();
            expect(code).toContain("export const CONSTRUCTION_META");
        });

        it("exports PROPS", () => {
            const code = generateCode();
            expect(code).toContain("export const PROPS");
        });

        it("exports SIGNALS", () => {
            const code = generateCode();
            expect(code).toContain("export const SIGNALS");
        });
    });
});
