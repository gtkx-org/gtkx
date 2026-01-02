import type { GirRepository } from "@gtkx/gir";
import { describe, expect, it } from "vitest";
import { GenerationContext } from "../../../../src/core/generation-context.js";
import { FfiMapper } from "../../../../src/core/type-system/ffi-mapper.js";
import { createWriters } from "../../../../src/core/writers/index.js";
import { ClassGenerator } from "../../../../src/ffi/generators/class/index.js";
import {
    createNormalizedClass,
    createNormalizedConstructor,
    createNormalizedMethod,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedSignal,
    createNormalizedType,
    qualifiedName,
} from "../../../fixtures/gir-fixtures.js";
import { createMockRepository } from "../../../fixtures/mock-repository.js";
import { createTestProject, createTestSourceFile, getGeneratedCode } from "../../../fixtures/ts-morph-helpers.js";

function createTestSetup(
    classOverrides: Partial<Parameters<typeof createNormalizedClass>[0]> = {},
    namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>> = new Map(),
) {
    const gtkNs = namespaces.get("Gtk") ?? createNormalizedNamespace({ name: "Gtk" });
    namespaces.set("Gtk", gtkNs);

    const widgetClass = createNormalizedClass({
        name: "Widget",
        qualifiedName: qualifiedName("Gtk", "Widget"),
        parent: null,
    });
    gtkNs.classes.set("Widget", widgetClass);

    const cls = createNormalizedClass({
        name: "Button",
        qualifiedName: qualifiedName("Gtk", "Button"),
        parent: qualifiedName("Gtk", "Widget"),
        ...classOverrides,
    });
    gtkNs.classes.set(cls.name, cls);

    const repo = createMockRepository(namespaces);
    const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
    const ctx = new GenerationContext();
    const writers = createWriters({
        sharedLibrary: "libgtk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
    });
    const options = {
        namespace: "Gtk",
        sharedLibrary: "libgtk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
        gobjectLibrary: "libgobject-2.0.so.0",
    };

    const project = createTestProject();
    const sourceFile = createTestSourceFile(project, "button.ts");

    const generator = new ClassGenerator(cls, ffiMapper, ctx, repo as unknown as GirRepository, writers, options);

    return { cls, generator, ctx, sourceFile, repo };
}

describe("ClassGenerator", () => {
    describe("constructor", () => {
        it("creates generator with class and dependencies", () => {
            const { generator } = createTestSetup();
            expect(generator).toBeInstanceOf(ClassGenerator);
        });
    });

    describe("generateToSourceFile", () => {
        it("returns success for valid class", () => {
            const { generator, sourceFile } = createTestSetup();

            const result = generator.generateToSourceFile(sourceFile);

            expect(result.success).toBe(true);
        });

        it("generates class with correct name", () => {
            const { generator, sourceFile } = createTestSetup({ name: "Button" });

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("export class Button");
        });

        it("generates class extending parent", () => {
            const { generator, sourceFile } = createTestSetup({
                parent: qualifiedName("Gtk", "Widget"),
            });

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("extends Widget");
        });

        it("generates class extending NativeObject when no parent", () => {
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const widgetClass = createNormalizedClass({
                name: "Widget",
                qualifiedName: qualifiedName("Gtk", "Widget"),
                parent: null,
            });
            gtkNs.classes.set("Widget", widgetClass);
            const namespaces = new Map([["Gtk", gtkNs]]);

            const { generator, sourceFile } = createTestSetup({ parent: null }, namespaces);

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("extends NativeObject");
        });

        it("includes glibTypeName property when present", () => {
            const { generator, sourceFile } = createTestSetup({
                glibTypeName: "GtkButton",
            });

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("glibTypeName");
            expect(code).toContain('"GtkButton"');
        });

        it("includes objectType property when glibTypeName present", () => {
            const { generator, sourceFile } = createTestSetup({
                glibTypeName: "GtkButton",
            });

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("objectType");
            expect(code).toContain('"gobject"');
        });

        it("generates methods for class", () => {
            const { generator, sourceFile } = createTestSetup({
                methods: [
                    createNormalizedMethod({
                        name: "get_label",
                        cIdentifier: "gtk_button_get_label",
                        returnType: createNormalizedType({ name: "utf8" }),
                    }),
                ],
            });

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("getLabel");
        });

        it("generates static functions", () => {
            const { generator, sourceFile } = createTestSetup({
                staticFunctions: [
                    {
                        name: "get_default_direction",
                        cIdentifier: "gtk_widget_get_default_direction",
                        returnType: createNormalizedType({ name: "gint" }),
                        parameters: [],
                        throws: false,
                    },
                ],
            });

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("getDefaultDirection");
        });

        it("adds registerNativeClass call when glibTypeName present", () => {
            const { generator, sourceFile } = createTestSetup({
                name: "Button",
                glibTypeName: "GtkButton",
            });

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("registerNativeClass(Button)");
        });
    });

    describe("widget metadata", () => {
        it("returns widget meta for widget class", () => {
            const { generator, sourceFile } = createTestSetup({
                name: "Button",
                parent: qualifiedName("Gtk", "Widget"),
            });

            const result = generator.generateToSourceFile(sourceFile);

            expect(result.widgetMeta).not.toBeNull();
        });

        it("includes className in widget meta", () => {
            const { generator, sourceFile } = createTestSetup({
                name: "Button",
                parent: qualifiedName("Gtk", "Widget"),
            });

            const result = generator.generateToSourceFile(sourceFile);

            expect(result.widgetMeta?.className).toBe("Button");
        });

        it("includes namespace in widget meta", () => {
            const { generator, sourceFile } = createTestSetup({
                name: "Button",
                parent: qualifiedName("Gtk", "Widget"),
            });

            const result = generator.generateToSourceFile(sourceFile);

            expect(result.widgetMeta?.namespace).toBe("Gtk");
        });

        it("adds WIDGET_META to class for widgets", () => {
            const { generator, sourceFile } = createTestSetup({
                name: "Button",
                parent: qualifiedName("Gtk", "Widget"),
            });

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("WIDGET_META");
        });
    });

    describe("context updates", () => {
        it("sets usesCall when class has methods", () => {
            const { generator, sourceFile, ctx } = createTestSetup({
                methods: [
                    createNormalizedMethod({
                        name: "get_value",
                        cIdentifier: "gtk_button_get_value",
                        returnType: createNormalizedType({ name: "gint" }),
                    }),
                ],
            });

            generator.generateToSourceFile(sourceFile);

            expect(ctx.usesCall).toBe(true);
        });

        it("sets usesRegisterNativeClass when class has glibTypeName", () => {
            const { generator, sourceFile, ctx } = createTestSetup({
                glibTypeName: "GtkButton",
            });

            generator.generateToSourceFile(sourceFile);

            expect(ctx.usesRegisterNativeClass).toBe(true);
        });

        it("sets usesNativeObject when class has no parent", () => {
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const widgetClass = createNormalizedClass({
                name: "Widget",
                qualifiedName: qualifiedName("Gtk", "Widget"),
                parent: null,
            });
            gtkNs.classes.set("Widget", widgetClass);
            const namespaces = new Map([["Gtk", gtkNs]]);

            const { generator, sourceFile, ctx } = createTestSetup({ parent: null }, namespaces);

            generator.generateToSourceFile(sourceFile);

            expect(ctx.usesNativeObject).toBe(true);
        });
    });

    describe("constructor generation", () => {
        it("generates constructor for class with constructors", () => {
            const { generator, sourceFile } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gtk_button_new",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [],
                    }),
                ],
            });

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("constructor");
        });

        it("generates factory methods for non-main constructors", () => {
            const { generator, sourceFile } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gtk_button_new",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [],
                    }),
                    createNormalizedConstructor({
                        name: "new_with_label",
                        cIdentifier: "gtk_button_new_with_label",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "label",
                                type: createNormalizedType({ name: "utf8" }),
                            }),
                        ],
                    }),
                ],
            });

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("newWithLabel");
        });
    });

    describe("signal generation", () => {
        it("generates connect method when class has signals", () => {
            const { generator, sourceFile } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" })],
            });

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("connect");
        });

        it("includes signal in WIDGET_META", () => {
            const { generator, sourceFile } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" })],
                parent: qualifiedName("Gtk", "Widget"),
            });

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("clicked");
        });
    });

    describe("JSDoc generation", () => {
        it("includes class documentation", () => {
            const { generator, sourceFile } = createTestSetup({
                doc: "A button widget for triggering actions",
            });

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("A button widget for triggering actions");
        });
    });

    describe("failure cases", () => {
        it("returns success false for class with only unsupported constructors", () => {
            const { generator, sourceFile } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new_with_callback",
                        cIdentifier: "gtk_button_new_with_callback",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [
                            createNormalizedParameter({
                                name: "callback",
                                type: createNormalizedType({ name: "GLib.Closure" }),
                            }),
                        ],
                    }),
                ],
            });

            const result = generator.generateToSourceFile(sourceFile);

            expect(result.success).toBe(false);
        });
    });

    describe("ParamSpec handling", () => {
        it("uses gparam objectType for ParamSpec classes", () => {
            const gobjectNs = createNormalizedNamespace({ name: "GObject" });
            const paramSpecClass = createNormalizedClass({
                name: "ParamSpec",
                qualifiedName: qualifiedName("GObject", "ParamSpec"),
                parent: null,
                glibTypeName: "GParam",
            });
            gobjectNs.classes.set("ParamSpec", paramSpecClass);
            const namespaces = new Map([["GObject", gobjectNs]]);

            const repo = createMockRepository(namespaces);
            const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "GObject");
            const ctx = new GenerationContext();
            const writers = createWriters({
                sharedLibrary: "libgobject-2.0.so.0",
                glibLibrary: "libglib-2.0.so.0",
            });
            const options = {
                namespace: "GObject",
                sharedLibrary: "libgobject-2.0.so.0",
                glibLibrary: "libglib-2.0.so.0",
                gobjectLibrary: "libgobject-2.0.so.0",
            };

            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "param-spec.ts");

            const generator = new ClassGenerator(
                paramSpecClass,
                ffiMapper,
                ctx,
                repo as unknown as GirRepository,
                writers,
                options,
            );

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain('"gparam"');
        });
    });

    describe("cross-namespace inheritance", () => {
        it("includes namespace prefix for cross-namespace parent", () => {
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const adwNs = createNormalizedNamespace({ name: "Adw" });

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

            const adwWindowClass = createNormalizedClass({
                name: "ApplicationWindow",
                qualifiedName: qualifiedName("Adw", "ApplicationWindow"),
                parent: qualifiedName("Gtk", "Window"),
            });
            adwNs.classes.set("ApplicationWindow", adwWindowClass);

            const namespaces = new Map([
                ["Gtk", gtkNs],
                ["Adw", adwNs],
            ]);

            const repo = createMockRepository(namespaces);
            const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Adw");
            const ctx = new GenerationContext();
            const writers = createWriters({
                sharedLibrary: "libadwaita-1.so.0",
                glibLibrary: "libglib-2.0.so.0",
            });
            const options = {
                namespace: "Adw",
                sharedLibrary: "libadwaita-1.so.0",
                glibLibrary: "libglib-2.0.so.0",
                gobjectLibrary: "libgobject-2.0.so.0",
            };

            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "application-window.ts");

            const generator = new ClassGenerator(
                adwWindowClass,
                ffiMapper,
                ctx,
                repo as unknown as GirRepository,
                writers,
                options,
            );

            generator.generateToSourceFile(sourceFile);

            const code = getGeneratedCode(sourceFile);
            expect(code).toContain("extends Gtk.Window");
        });
    });
});
