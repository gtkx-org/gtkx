import { describe, expect, it } from "vitest";
import { ConstructorAnalyzer } from "../../../src/core/analyzers/constructor-analyzer.js";
import {
    createNormalizedClass,
    createNormalizedConstructor,
    createNormalizedInterface,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedProperty,
    createNormalizedType,
    qualifiedName,
} from "../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../fixtures/mock-repository.js";

function createTestSetup(namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>>) {
    const repo = createMockRepository(namespaces);
    const analyzer = new ConstructorAnalyzer(repo as Parameters<typeof ConstructorAnalyzer>[0]);
    return { repo, analyzer };
}

describe("ConstructorAnalyzer", () => {
    describe("getConstructorParamNames", () => {
        it("returns empty array for class without new constructor", () => {
            const cls = createNormalizedClass({
                constructors: [
                    createNormalizedConstructor({
                        name: "new_with_label",
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.getConstructorParamNames(cls);

            expect(result).toHaveLength(0);
        });

        it("returns empty array for class without constructors", () => {
            const cls = createNormalizedClass({ constructors: [] });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Widget", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.getConstructorParamNames(cls);

            expect(result).toHaveLength(0);
        });

        it("extracts constructor parameters that match properties", () => {
            const cls = createNormalizedClass({
                name: "Box",
                properties: [
                    createNormalizedProperty({ name: "orientation" }),
                    createNormalizedProperty({ name: "spacing" }),
                ],
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        parameters: [
                            createNormalizedParameter({
                                name: "orientation",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                            createNormalizedParameter({
                                name: "spacing",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                        ],
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Box", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.getConstructorParamNames(cls);

            expect(result).toEqual(["orientation", "spacing"]);
        });

        it("filters out application parameter", () => {
            const cls = createNormalizedClass({
                name: "ApplicationWindow",
                properties: [createNormalizedProperty({ name: "title" })],
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        parameters: [
                            createNormalizedParameter({
                                name: "application",
                                type: createNormalizedType({ name: "Gio.Application" }),
                            }),
                            createNormalizedParameter({
                                name: "title",
                                type: createNormalizedType({ name: "utf8" }),
                            }),
                        ],
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["ApplicationWindow", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.getConstructorParamNames(cls);

            expect(result).not.toContain("application");
        });

        it("filters out parameters without matching properties", () => {
            const cls = createNormalizedClass({
                name: "Button",
                properties: [createNormalizedProperty({ name: "label" })],
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        parameters: [
                            createNormalizedParameter({
                                name: "label",
                                type: createNormalizedType({ name: "utf8" }),
                            }),
                            createNormalizedParameter({
                                name: "mnemonic",
                                type: createNormalizedType({ name: "utf8" }),
                            }),
                        ],
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.getConstructorParamNames(cls);

            expect(result).toEqual(["label"]);
            expect(result).not.toContain("mnemonic");
        });

        it("converts snake_case parameters to camelCase", () => {
            const cls = createNormalizedClass({
                name: "Grid",
                properties: [
                    createNormalizedProperty({ name: "row-spacing" }),
                    createNormalizedProperty({ name: "column-spacing" }),
                ],
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        parameters: [
                            createNormalizedParameter({
                                name: "row_spacing",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                            createNormalizedParameter({
                                name: "column_spacing",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                        ],
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Grid", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.getConstructorParamNames(cls);

            expect(result).toContain("rowSpacing");
            expect(result).toContain("columnSpacing");
        });

        it("includes parameters matching interface properties", () => {
            const orientable = createNormalizedInterface({
                name: "Orientable",
                qualifiedName: qualifiedName("Gtk", "Orientable"),
                properties: [createNormalizedProperty({ name: "orientation" })],
            });

            const boxClass = createNormalizedClass({
                name: "Box",
                implements: [qualifiedName("Gtk", "Orientable")],
                properties: [createNormalizedProperty({ name: "spacing" })],
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        parameters: [
                            createNormalizedParameter({
                                name: "orientation",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                            createNormalizedParameter({
                                name: "spacing",
                                type: createNormalizedType({ name: "gint" }),
                            }),
                        ],
                    }),
                ],
            });

            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Box", boxClass]]),
                interfaces: new Map([["Orientable", orientable]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.getConstructorParamNames(boxClass);

            expect(result).toContain("orientation");
            expect(result).toContain("spacing");
        });

        it("handles class without any parameters in new constructor", () => {
            const cls = createNormalizedClass({
                name: "Widget",
                parent: null,
                properties: [createNormalizedProperty({ name: "visible" })],
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        parameters: [],
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Widget", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.getConstructorParamNames(cls);

            expect(result).toHaveLength(0);
        });

        it("handles property names with underscores matching constructor params", () => {
            const cls = createNormalizedClass({
                name: "Entry",
                properties: [createNormalizedProperty({ name: "buffer" })],
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        parameters: [
                            createNormalizedParameter({
                                name: "buffer",
                                type: createNormalizedType({ name: "Gtk.EntryBuffer" }),
                            }),
                        ],
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Entry", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.getConstructorParamNames(cls);

            expect(result).toEqual(["buffer"]);
        });

        it("preserves parameter order", () => {
            const cls = createNormalizedClass({
                name: "ProgressBar",
                properties: [
                    createNormalizedProperty({ name: "min" }),
                    createNormalizedProperty({ name: "max" }),
                    createNormalizedProperty({ name: "value" }),
                ],
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        parameters: [
                            createNormalizedParameter({ name: "min", type: createNormalizedType({ name: "gdouble" }) }),
                            createNormalizedParameter({ name: "max", type: createNormalizedType({ name: "gdouble" }) }),
                            createNormalizedParameter({
                                name: "value",
                                type: createNormalizedType({ name: "gdouble" }),
                            }),
                        ],
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["ProgressBar", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.getConstructorParamNames(cls);

            expect(result).toEqual(["min", "max", "value"]);
        });
    });
});
