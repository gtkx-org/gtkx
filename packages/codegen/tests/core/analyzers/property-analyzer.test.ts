import { describe, expect, it } from "vitest";
import { PropertyAnalyzer } from "../../../src/core/analyzers/property-analyzer.js";
import { FfiMapper } from "../../../src/core/type-system/ffi-mapper.js";
import {
    createNormalizedClass,
    createNormalizedConstructor,
    createNormalizedInterface,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedProperty,
    createNormalizedType,
    createWidgetClass,
    qualifiedName,
} from "../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../fixtures/mock-repository.js";

function createTestSetup(namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>>) {
    const repo = createMockRepository(namespaces);
    const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
    const analyzer = new PropertyAnalyzer(repo as Parameters<typeof PropertyAnalyzer>[0], mapper);
    return { repo, mapper, analyzer };
}

describe("PropertyAnalyzer", () => {
    describe("analyzeWidgetProperties", () => {
        it("returns empty array for class with no properties", () => {
            const cls = createNormalizedClass({ properties: [] });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetProperties(cls);

            expect(result).toHaveLength(0);
        });

        it("analyzes property with basic types", () => {
            const cls = createNormalizedClass({
                name: "Button",
                parent: null,
                properties: [createNormalizedProperty({ name: "label", type: createNormalizedType({ name: "utf8" }) })],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetProperties(cls);

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                name: "label",
                camelName: "label",
                type: "string",
                isWritable: true,
            });
        });

        it("converts property name to camelCase", () => {
            const cls = createNormalizedClass({
                name: "Button",
                parent: null,
                properties: [
                    createNormalizedProperty({
                        name: "icon-name",
                        type: createNormalizedType({ name: "utf8" }),
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetProperties(cls);

            expect(result[0]?.camelName).toBe("iconName");
        });

        it("marks property as required when in constructor", () => {
            const cls = createNormalizedClass({
                name: "Box",
                parent: null,
                properties: [
                    createNormalizedProperty({
                        name: "orientation",
                        type: createNormalizedType({ name: "gint" }),
                    }),
                    createNormalizedProperty({
                        name: "spacing",
                        type: createNormalizedType({ name: "gint" }),
                    }),
                ],
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        parameters: [
                            createNormalizedParameter({
                                name: "orientation",
                                type: createNormalizedType({ name: "gint" }),
                                nullable: false,
                                optional: false,
                            }),
                            createNormalizedParameter({
                                name: "spacing",
                                type: createNormalizedType({ name: "gint" }),
                                nullable: false,
                                optional: false,
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

            const result = analyzer.analyzeWidgetProperties(cls);

            expect(result.find((p) => p.name === "orientation")?.isRequired).toBe(true);
            expect(result.find((p) => p.name === "spacing")?.isRequired).toBe(true);
        });

        it("marks property as not required when nullable in constructor", () => {
            const cls = createNormalizedClass({
                name: "Button",
                parent: null,
                properties: [
                    createNormalizedProperty({
                        name: "label",
                        type: createNormalizedType({ name: "utf8" }),
                    }),
                ],
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        parameters: [
                            createNormalizedParameter({
                                name: "label",
                                type: createNormalizedType({ name: "utf8" }),
                                nullable: true,
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

            const result = analyzer.analyzeWidgetProperties(cls);

            expect(result[0]?.isRequired).toBe(false);
        });

        it("marks read-only property correctly", () => {
            const cls = createNormalizedClass({
                name: "Widget",
                parent: null,
                properties: [
                    createNormalizedProperty({
                        name: "allocated-width",
                        type: createNormalizedType({ name: "gint" }),
                        writable: false,
                        readable: true,
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Widget", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetProperties(cls);

            expect(result[0]?.isWritable).toBe(false);
        });

        it("excludes hidden properties", () => {
            const cls = createNormalizedClass({
                name: "Widget",
                parent: null,
                properties: [
                    createNormalizedProperty({ name: "visible" }),
                    createNormalizedProperty({ name: "sensitive" }),
                    createNormalizedProperty({ name: "internal-prop" }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Widget", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const hiddenProps = new Set(["internalProp"]);
            const result = analyzer.analyzeWidgetProperties(cls, hiddenProps);

            expect(result).toHaveLength(2);
            expect(result.map((p) => p.name)).not.toContain("internal-prop");
        });

        it("excludes properties inherited from parent class", () => {
            const widgetClass = createWidgetClass();
            const buttonClass = createNormalizedClass({
                name: "Button",
                qualifiedName: qualifiedName("Gtk", "Button"),
                parent: qualifiedName("Gtk", "Widget"),
                properties: [
                    createNormalizedProperty({ name: "label" }),
                    createNormalizedProperty({ name: "icon-name" }),
                ],
            });

            widgetClass._setRepository({
                resolveClass: () => undefined,
                resolveInterface: () => undefined,
                findClasses: () => [],
            } as Parameters<typeof widgetClass._setRepository>[0]);

            buttonClass._setRepository({
                resolveClass: () => widgetClass,
                resolveInterface: () => undefined,
                findClasses: () => [],
            } as Parameters<typeof buttonClass._setRepository>[0]);

            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([
                    ["Widget", widgetClass],
                    ["Button", buttonClass],
                ]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetProperties(buttonClass);

            expect(result.map((p) => p.name)).toContain("label");
            expect(result.map((p) => p.name)).toContain("icon-name");
            expect(result.map((p) => p.name)).not.toContain("visible");
            expect(result.map((p) => p.name)).not.toContain("sensitive");
        });

        it("includes properties from directly implemented interfaces", () => {
            const orientable = createNormalizedInterface({
                name: "Orientable",
                qualifiedName: qualifiedName("Gtk", "Orientable"),
                properties: [
                    createNormalizedProperty({
                        name: "orientation",
                        type: createNormalizedType({ name: "gint" }),
                    }),
                ],
            });
            const boxClass = createNormalizedClass({
                name: "Box",
                parent: null,
                implements: [qualifiedName("Gtk", "Orientable")],
                properties: [createNormalizedProperty({ name: "spacing" })],
            });

            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Box", boxClass]]),
                interfaces: new Map([["Orientable", orientable]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetProperties(boxClass);

            expect(result.map((p) => p.name)).toContain("orientation");
            expect(result.map((p) => p.name)).toContain("spacing");
        });

        it("preserves getter and setter names", () => {
            const cls = createNormalizedClass({
                name: "Button",
                parent: null,
                properties: [
                    createNormalizedProperty({
                        name: "label",
                        getter: "get_label",
                        setter: "set_label",
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetProperties(cls);

            expect(result[0]?.getter).toBe("get_label");
            expect(result[0]?.setter).toBe("set_label");
        });

        it("tracks referenced external namespaces", () => {
            const gdkTexture = createNormalizedClass({
                name: "Texture",
                qualifiedName: qualifiedName("Gdk", "Texture"),
            });
            const gdkNs = createNormalizedNamespace({
                name: "Gdk",
                classes: new Map([["Texture", gdkTexture]]),
            });

            const imageClass = createNormalizedClass({
                name: "Image",
                parent: null,
                properties: [
                    createNormalizedProperty({
                        name: "paintable",
                        type: createNormalizedType({ name: "Gdk.Texture" }),
                    }),
                ],
            });
            const gtkNs = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Image", imageClass]]),
            });

            const repo = createMockRepository(
                new Map([
                    ["Gtk", gtkNs],
                    ["Gdk", gdkNs],
                ]),
            );
            const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
            const analyzer = new PropertyAnalyzer(repo as Parameters<typeof PropertyAnalyzer>[0], mapper);

            const result = analyzer.analyzeWidgetProperties(imageClass);

            expect(result[0]?.referencedNamespaces).toContain("Gdk");
        });

        it("excludes application parameter from required check", () => {
            const cls = createNormalizedClass({
                name: "ApplicationWindow",
                parent: null,
                properties: [createNormalizedProperty({ name: "title" })],
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        parameters: [
                            createNormalizedParameter({
                                name: "application",
                                type: createNormalizedType({ name: "Gio.Application" }),
                                nullable: false,
                                optional: false,
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

            const result = analyzer.analyzeWidgetProperties(cls);

            expect(result.find((p) => p.name === "title")?.isRequired).toBe(false);
        });

        it("preserves documentation", () => {
            const cls = createNormalizedClass({
                name: "Button",
                parent: null,
                properties: [
                    createNormalizedProperty({
                        name: "label",
                        doc: "The text shown in the button.",
                    }),
                ],
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", cls]]),
            });
            const { analyzer } = createTestSetup(new Map([["Gtk", ns]]));

            const result = analyzer.analyzeWidgetProperties(cls);

            expect(result[0]?.doc).toBe("The text shown in the button.");
        });

        it("qualifies external types in property type", () => {
            const gdkRectangle = createNormalizedClass({
                name: "Rectangle",
                qualifiedName: qualifiedName("Gdk", "Rectangle"),
            });
            const gdkNs = createNormalizedNamespace({
                name: "Gdk",
                classes: new Map([["Rectangle", gdkRectangle]]),
            });

            const widgetClass = createNormalizedClass({
                name: "Widget",
                parent: null,
                properties: [
                    createNormalizedProperty({
                        name: "clip",
                        type: createNormalizedType({ name: "Gdk.Rectangle" }),
                    }),
                ],
            });
            const gtkNs = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Widget", widgetClass]]),
            });

            const repo = createMockRepository(
                new Map([
                    ["Gtk", gtkNs],
                    ["Gdk", gdkNs],
                ]),
            );
            const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
            const analyzer = new PropertyAnalyzer(repo as Parameters<typeof PropertyAnalyzer>[0], mapper);

            const result = analyzer.analyzeWidgetProperties(widgetClass);

            expect(result[0]?.type).toBe("Gdk.Rectangle");
        });
    });
});
