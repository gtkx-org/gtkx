import type { GirRepository } from "@gtkx/gir";
import { describe, expect, it } from "vitest";
import { GenerationContext } from "../../../../src/core/generation-context.js";
import {
    type WidgetMetaAnalyzers,
    WidgetMetaBuilder,
} from "../../../../src/ffi/generators/class/widget-meta-builder.js";
import {
    createNormalizedClass,
    createNormalizedMethod,
    createNormalizedNamespace,
    createNormalizedProperty,
    createNormalizedType,
    qualifiedName,
} from "../../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../../fixtures/mock-repository.js";
import { createTestProject, createTestSourceFile, getGeneratedCode } from "../../../fixtures/ts-morph-helpers.js";

function createMockAnalyzers(): WidgetMetaAnalyzers {
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
    } as WidgetMetaAnalyzers;
}

function createTestSetup(
    classOverrides: Partial<Parameters<typeof createNormalizedClass>[0]> = {},
    namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>> = new Map(),
    analyzerOverrides: Partial<WidgetMetaAnalyzers> = {},
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
    const ctx = new GenerationContext();
    const analyzers = { ...createMockAnalyzers(), ...analyzerOverrides };

    const project = createTestProject();
    const sourceFile = createTestSourceFile(project, "button.ts");
    const classDecl = sourceFile.addClass({ name: "Button" });

    const builder = new WidgetMetaBuilder(cls, repo as unknown as GirRepository, ctx, "Gtk", analyzers);

    return { cls, builder, ctx, classDecl, sourceFile, analyzers, repo };
}

describe("WidgetMetaBuilder", () => {
    describe("constructor", () => {
        it("creates builder with class and dependencies", () => {
            const { builder } = createTestSetup();
            expect(builder).toBeInstanceOf(WidgetMetaBuilder);
        });
    });

    describe("isWidget", () => {
        it("returns true for class that extends Widget", () => {
            const { cls } = createTestSetup();

            const isSubclass = cls.isSubclassOf(qualifiedName("Gtk", "Widget"));
            expect(isSubclass).toBe(true);
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
            createMockRepository(namespaces);

            const isSubclass = cls.isSubclassOf(qualifiedName("Gtk", "Widget"));
            expect(isSubclass).toBe(false);
        });
    });

    describe("setSignalEntries", () => {
        it("accepts signal entries array", () => {
            const { builder } = createTestSetup();

            expect(() =>
                builder.setSignalEntries([
                    {
                        name: "clicked",
                        params: [],
                        returnType: (w) => w.write('{ type: "undefined" }'),
                    },
                ]),
            ).not.toThrow();
        });
    });

    describe("addToClass", () => {
        it("returns false for non-widget class", () => {
            const { classDecl } = createTestSetup();

            const cls = createNormalizedClass({
                name: "Object",
                qualifiedName: qualifiedName("GObject", "Object"),
                parent: null,
            });

            const repo = createMockRepository(new Map());
            const ctx = new GenerationContext();
            const analyzers = createMockAnalyzers();

            const builder = new WidgetMetaBuilder(cls, repo as unknown as GirRepository, ctx, "GObject", analyzers);

            const result = builder.addToClass(classDecl);

            expect(result).toBe(false);
        });

        it("adds WIDGET_META property to class", () => {
            const { builder, classDecl, sourceFile } = createTestSetup();

            builder.addToClass(classDecl);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("WIDGET_META");
        });

        it("WIDGET_META is static", () => {
            const { builder, classDecl, sourceFile } = createTestSetup();

            builder.addToClass(classDecl);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("static");
        });

        it("WIDGET_META is readonly", () => {
            const { builder, classDecl, sourceFile } = createTestSetup();

            builder.addToClass(classDecl);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("readonly");
        });
    });

    describe("context updates", () => {
        it("sets usesRuntimeWidgetMeta flag when adding WIDGET_META", () => {
            const { builder, classDecl, ctx } = createTestSetup();

            builder.addToClass(classDecl);

            expect(ctx.usesRuntimeWidgetMeta).toBe(true);
        });
    });

    describe("computeMetadata", () => {
        it("returns metadata object with isContainer", () => {
            const { builder } = createTestSetup();

            const metadata = builder.computeMetadata();

            expect(metadata).toHaveProperty("isContainer");
        });

        it("returns metadata object with slots array", () => {
            const { builder } = createTestSetup();

            const metadata = builder.computeMetadata();

            expect(metadata).toHaveProperty("slots");
            expect(Array.isArray(metadata.slots)).toBe(true);
        });

        it("returns metadata object with propNames array", () => {
            const { builder } = createTestSetup();

            const metadata = builder.computeMetadata();

            expect(metadata).toHaveProperty("propNames");
            expect(Array.isArray(metadata.propNames)).toBe(true);
        });

        it("detects container from append method", () => {
            const { builder } = createTestSetup({
                methods: [
                    createNormalizedMethod({
                        name: "append",
                        cIdentifier: "gtk_box_append",
                        returnType: createNormalizedType({ name: "none" }),
                    }),
                ],
            });

            const metadata = builder.computeMetadata();

            expect(metadata.isContainer).toBe(true);
        });

        it("detects container from set_child method", () => {
            const { builder } = createTestSetup({
                methods: [
                    createNormalizedMethod({
                        name: "set_child",
                        cIdentifier: "gtk_button_set_child",
                        returnType: createNormalizedType({ name: "none" }),
                    }),
                ],
            });

            const metadata = builder.computeMetadata();

            expect(metadata.isContainer).toBe(true);
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
            const ctx = new GenerationContext();
            const analyzers = createMockAnalyzers();

            const builder = new WidgetMetaBuilder(cls, repo as unknown as GirRepository, ctx, "GObject", analyzers);

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
    });

    describe("slot detection", () => {
        it("returns empty slots when no widget properties", () => {
            const { builder } = createTestSetup({
                properties: [],
            });

            const metadata = builder.computeMetadata();

            expect(metadata.slots).toHaveLength(0);
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
                            name: "child",
                            type: createNormalizedType({ name: qualifiedName("Gtk", "Widget") }),
                            writable: true,
                        }),
                    ],
                },
                namespaces,
            );

            const metadata = builder.computeMetadata();

            expect(metadata.slots).toContain("child");
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

            const metadata = builder.computeMetadata();

            expect(metadata.slots).not.toContain("child");
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
            const ctx = new GenerationContext();
            const analyzers = createMockAnalyzers();

            const builder = new WidgetMetaBuilder(widgetClass, repo as unknown as GirRepository, ctx, "Gtk", analyzers);

            const result = builder.buildCodegenWidgetMeta();

            expect(result?.parentClassName).toBeNull();
            expect(result?.parentNamespace).toBeNull();
        });
    });
});
