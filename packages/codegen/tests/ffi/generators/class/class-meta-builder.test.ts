import type { GirRepository } from "@gtkx/gir";
import { describe, expect, it } from "vitest";
import { type ClassMetaAnalyzers, ClassMetaBuilder } from "../../../../src/ffi/generators/class/class-meta-builder.js";
import {
    createNormalizedClass,
    createNormalizedNamespace,
    createNormalizedProperty,
    createNormalizedType,
    qualifiedName,
} from "../../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../../fixtures/mock-repository.js";

function createMockAnalyzers(): ClassMetaAnalyzers {
    return {
        property: {
            analyzeWidgetProperties: () => [],
        },
        signal: {
            analyzeWidgetSignals: () => [],
        },
        constructor: {
            getConstructorParamNames: () => [],
        },
    } as ClassMetaAnalyzers;
}

function createTestSetup(
    classOverrides: Partial<Parameters<typeof createNormalizedClass>[0]> = {},
    namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>> = new Map(),
    analyzerOverrides: Partial<ClassMetaAnalyzers> = {},
) {
    const ns = namespaces.get("Gtk") ?? createNormalizedNamespace({ name: "Gtk" });
    namespaces.set("Gtk", ns);

    const widgetClass = createNormalizedClass({
        name: "Widget",
        qualifiedName: qualifiedName("Gtk", "Widget"),
        parent: null,
    });
    ns.classes.set("Widget", widgetClass);

    const cls = createNormalizedClass({
        name: "Button",
        qualifiedName: qualifiedName("Gtk", "Button"),
        parent: qualifiedName("Gtk", "Widget"),
        ...classOverrides,
    });
    ns.classes.set(cls.name, cls);

    const repo = createMockRepository(namespaces);
    const analyzers = { ...createMockAnalyzers(), ...analyzerOverrides };

    const builder = new ClassMetaBuilder(cls, repo as unknown as GirRepository, "Gtk", analyzers);

    return { cls, builder, analyzers, repo };
}

describe("ClassMetaBuilder", () => {
    describe("constructor", () => {
        it("creates builder with class and dependencies", () => {
            const { builder } = createTestSetup();
            expect(builder).toBeInstanceOf(ClassMetaBuilder);
        });
    });

    describe("isWidget", () => {
        it("returns true for class that extends Widget", () => {
            const { builder } = createTestSetup();
            expect(builder.isWidget()).toBe(true);
        });

        it("returns false for class that does not extend Widget", () => {
            const ns = createNormalizedNamespace({ name: "GObject" });
            const cls = createNormalizedClass({
                name: "Object",
                qualifiedName: qualifiedName("GObject", "Object"),
                parent: null,
            });
            ns.classes.set("Object", cls);
            const namespaces = new Map([["GObject", ns]]);
            const repo = createMockRepository(namespaces);
            const analyzers = createMockAnalyzers();

            const builder = new ClassMetaBuilder(cls, repo as unknown as GirRepository, "GObject", analyzers);

            expect(builder.isWidget()).toBe(false);
        });
    });

    describe("buildCodegenWidgetMeta", () => {
        it("returns null for non-widget class", () => {
            const cls = createNormalizedClass({
                name: "Object",
                qualifiedName: qualifiedName("GObject", "Object"),
                parent: null,
            });

            const repo = createMockRepository(new Map());
            const analyzers = createMockAnalyzers();

            const builder = new ClassMetaBuilder(cls, repo as unknown as GirRepository, "GObject", analyzers);

            const result = builder.buildCodegenWidgetMeta();

            expect(result).toBeNull();
        });

        it("returns CodegenWidgetMeta for widget class", () => {
            const { builder } = createTestSetup();

            const result = builder.buildCodegenWidgetMeta();

            expect(result).not.toBeNull();
        });

        it("includes className in CodegenWidgetMeta", () => {
            const { builder } = createTestSetup({ name: "Button" });

            const result = builder.buildCodegenWidgetMeta();

            expect(result?.className).toBe("Button");
        });

        it("includes namespace in CodegenWidgetMeta", () => {
            const { builder } = createTestSetup();

            const result = builder.buildCodegenWidgetMeta();

            expect(result?.namespace).toBe("Gtk");
        });

        it("includes jsxName in CodegenWidgetMeta", () => {
            const { builder } = createTestSetup({ name: "Button" });

            const result = builder.buildCodegenWidgetMeta();

            expect(result?.jsxName).toBe("GtkButton");
        });

        it("includes modulePath in CodegenWidgetMeta", () => {
            const { builder } = createTestSetup({ name: "Button" });

            const result = builder.buildCodegenWidgetMeta();

            expect(result?.modulePath).toBe("./button.js");
        });

        it("includes slots in CodegenWidgetMeta", () => {
            const { builder } = createTestSetup();

            const result = builder.buildCodegenWidgetMeta();

            expect(result).toHaveProperty("slots");
            expect(Array.isArray(result?.slots)).toBe(true);
        });
    });

    describe("slot detection", () => {
        it("returns empty slots when no widget properties", () => {
            const { builder } = createTestSetup({
                properties: [],
            });

            const result = builder.buildCodegenWidgetMeta();

            expect(result?.slots).toHaveLength(0);
        });

        it("includes writable widget-type properties as slots", () => {
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const widgetClass = createNormalizedClass({
                name: "Widget",
                qualifiedName: qualifiedName("Gtk", "Widget"),
                parent: null,
            });
            gtkNs.classes.set("Widget", widgetClass);

            const namespaces = new Map([["Gtk", gtkNs]]);

            const { builder } = createTestSetup(
                {
                    properties: [
                        createNormalizedProperty({
                            name: "content",
                            type: createNormalizedType({ name: qualifiedName("Gtk", "Widget") }),
                            writable: true,
                        }),
                    ],
                },
                namespaces,
            );

            const result = builder.buildCodegenWidgetMeta();

            expect(result?.slots).toContain("content");
        });

        it("excludes non-writable widget properties from slots", () => {
            const { builder } = createTestSetup({
                properties: [
                    createNormalizedProperty({
                        name: "child",
                        type: createNormalizedType({ name: qualifiedName("Gtk", "Widget") }),
                        writable: false,
                    }),
                ],
            });

            const result = builder.buildCodegenWidgetMeta();

            expect(result?.slots).not.toContain("child");
        });
    });

    describe("parent info extraction", () => {
        it("extracts parent info for same-namespace parent", () => {
            const { builder } = createTestSetup({
                name: "Button",
                parent: qualifiedName("Gtk", "Widget"),
            });

            const result = builder.buildCodegenWidgetMeta();

            expect(result?.parentNamespace).toBe("Gtk");
        });

        it("extracts parent info for widget with intermediate parent", () => {
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const widgetClass = createNormalizedClass({
                name: "Widget",
                qualifiedName: qualifiedName("Gtk", "Widget"),
                parent: null,
            });
            gtkNs.classes.set("Widget", widgetClass);

            const windowClass = createNormalizedClass({
                name: "Window",
                qualifiedName: qualifiedName("Gtk", "Window"),
                parent: qualifiedName("Gtk", "Widget"),
            });
            gtkNs.classes.set("Window", windowClass);

            const namespaces = new Map([["Gtk", gtkNs]]);

            const { builder } = createTestSetup(
                {
                    name: "ApplicationWindow",
                    parent: qualifiedName("Gtk", "Window"),
                },
                namespaces,
            );

            const result = builder.buildCodegenWidgetMeta();

            expect(result?.parentNamespace).toBe("Gtk");
            expect(result?.parentClassName).toBe("Window");
        });

        it("handles null parent for Widget class", () => {
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const widgetClass = createNormalizedClass({
                name: "Widget",
                qualifiedName: qualifiedName("Gtk", "Widget"),
                parent: null,
            });
            gtkNs.classes.set("Widget", widgetClass);
            const namespaces = new Map([["Gtk", gtkNs]]);
            const repo = createMockRepository(namespaces);
            const analyzers = createMockAnalyzers();

            const builder = new ClassMetaBuilder(widgetClass, repo as unknown as GirRepository, "Gtk", analyzers);

            const result = builder.buildCodegenWidgetMeta();

            expect(result?.parentClassName).toBeNull();
            expect(result?.parentNamespace).toBeNull();
        });
    });
});
