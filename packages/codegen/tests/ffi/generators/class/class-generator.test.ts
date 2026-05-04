import type { GirRepository } from "@gtkx/gir";
import { describe, expect, it } from "vitest";
import { fileBuilder } from "../../../../src/builders/file-builder.js";
import { stringify } from "../../../../src/builders/stringify.js";
import { FfiMapper } from "../../../../src/core/type-system/ffi-mapper.js";
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
    const file = fileBuilder();
    const options = {
        namespace: "Gtk",
        sharedLibrary: "libgtk-4.so.1",
        glibLibrary: "libglib-2.0.so.0",
        gobjectLibrary: "libgobject-2.0.so.0",
    };

    const generator = new ClassGenerator(cls, ffiMapper, file, repo as unknown as GirRepository, options);

    return { cls, generator, file, repo };
}

describe("ClassGenerator", () => {
    describe("constructor", () => {
        it("creates generator with class and dependencies", () => {
            const { generator } = createTestSetup();
            expect(generator).toBeInstanceOf(ClassGenerator);
        });
    });

    describe("generateToSourceFile", () => {
        it("returns a result for a valid class", () => {
            const { generator } = createTestSetup();

            const result = generator.generate();

            expect(result).toBeDefined();
        });

        it("generates class with correct name", () => {
            const { generator, file } = createTestSetup({ name: "Button" });

            generator.generate();

            const code = stringify(file);
            expect(code).toContain("export class Button");
        });

        it("generates class extending parent", () => {
            const { generator, file } = createTestSetup({
                parent: qualifiedName("Gtk", "Widget"),
            });

            generator.generate();

            const code = stringify(file);
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

            const { generator, file } = createTestSetup({ parent: null }, namespaces);

            generator.generate();

            const code = stringify(file);
            expect(code).toContain("extends NativeObject");
        });

        it("includes glibTypeName property when present", () => {
            const { generator, file } = createTestSetup({
                glibTypeName: "GtkButton",
            });

            generator.generate();

            const code = stringify(file);
            expect(code).toContain("glibTypeName");
            expect(code).toContain('"GtkButton"');
        });

        it("includes objectType property when glibTypeName present", () => {
            const { generator, file } = createTestSetup({
                glibTypeName: "GtkButton",
            });

            generator.generate();

            const code = stringify(file);
            expect(code).toContain("objectType");
            expect(code).toContain('"gobject"');
        });

        it("generates methods for class", () => {
            const { generator, file } = createTestSetup({
                methods: [
                    createNormalizedMethod({
                        name: "get_label",
                        cIdentifier: "gtk_button_get_label",
                        returnType: createNormalizedType({ name: "utf8" }),
                    }),
                ],
            });

            generator.generate();

            const code = stringify(file);
            expect(code).toContain("getLabel");
        });

        it("generates static functions", () => {
            const { generator, file } = createTestSetup({
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

            generator.generate();

            const code = stringify(file);
            expect(code).toContain("getDefaultDirection");
        });

        it("adds registerNativeClass call when glibTypeName present", () => {
            const { generator, file } = createTestSetup({
                name: "Button",
                glibTypeName: "GtkButton",
            });

            generator.generate();

            const code = stringify(file);
            expect(code).toContain("registerNativeClass(Button)");
        });
    });

    describe("widget metadata", () => {
        it("returns widget meta for widget class", () => {
            const { generator } = createTestSetup({
                name: "Button",
                parent: qualifiedName("Gtk", "Widget"),
            });

            const result = generator.generate();

            expect(result.widgetMeta).not.toBeNull();
        });

        it("includes className in widget meta", () => {
            const { generator } = createTestSetup({
                name: "Button",
                parent: qualifiedName("Gtk", "Widget"),
            });

            const result = generator.generate();

            expect(result.widgetMeta?.className).toBe("Button");
        });

        it("includes namespace in widget meta", () => {
            const { generator } = createTestSetup({
                name: "Button",
                parent: qualifiedName("Gtk", "Widget"),
            });

            const result = generator.generate();

            expect(result.widgetMeta?.namespace).toBe("Gtk");
        });
    });

    describe("context updates", () => {
        it("sets usesCall when class has methods", () => {
            const { generator, file } = createTestSetup({
                methods: [
                    createNormalizedMethod({
                        name: "get_value",
                        cIdentifier: "gtk_button_get_value",
                        returnType: createNormalizedType({ name: "gint" }),
                    }),
                ],
            });

            generator.generate();

            expect(stringify(file)).toContain("call");
        });

        it("sets usesRegisterNativeClass when class has glibTypeName", () => {
            const { generator, file } = createTestSetup({
                glibTypeName: "GtkButton",
            });

            generator.generate();

            expect(stringify(file)).toContain("registerNativeClass");
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

            const { generator, file } = createTestSetup({ parent: null }, namespaces);

            generator.generate();

            expect(stringify(file)).toContain("NativeObject");
        });
    });

    describe("constructor generation", () => {
        it("generates constructor for class with constructors", () => {
            const { generator, file } = createTestSetup({
                constructors: [
                    createNormalizedConstructor({
                        name: "new",
                        cIdentifier: "gtk_button_new",
                        returnType: createNormalizedType({ name: "Gtk.Button" }),
                        parameters: [],
                    }),
                ],
            });

            generator.generate();

            const code = stringify(file);
            expect(code).toContain("constructor");
        });

        it("generates factory methods for non-main constructors", () => {
            const { generator, file } = createTestSetup({
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

            generator.generate();

            const code = stringify(file);
            expect(code).toContain("newWithLabel");
        });
    });

    describe("signal generation", () => {
        it("generates connect method when class has signals", () => {
            const { generator, file } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" })],
            });

            generator.generate();

            const code = stringify(file);
            expect(code).toContain("connect");
        });

        it("includes signal in WIDGET_META", () => {
            const { generator, file } = createTestSetup({
                signals: [createNormalizedSignal({ name: "clicked" })],
                parent: qualifiedName("Gtk", "Widget"),
            });

            generator.generate();

            const code = stringify(file);
            expect(code).toContain("clicked");
        });
    });

    describe("JSDoc generation", () => {
        it("includes class documentation", () => {
            const { generator, file } = createTestSetup({
                doc: "A button widget for triggering actions",
            });

            generator.generate();

            const code = stringify(file);
            expect(code).toContain("A button widget for triggering actions");
        });
    });

    describe("empty-shell behavior", () => {
        it("still emits a class shell when every constructor has unsafe parameters", () => {
            const { generator, file } = createTestSetup({
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

            const result = generator.generate();
            const code = stringify(file);

            expect(result).toBeDefined();
            expect(code).toContain("export class Button");
        });
    });

    describe("ParamSpec handling", () => {
        it("uses fundamental objectType for ParamSpec classes", () => {
            const gobjectNs = createNormalizedNamespace({
                name: "GObject",
                sharedLibrary: "libgobject-2.0.so.0",
            });
            const paramSpecClass = createNormalizedClass({
                name: "ParamSpec",
                qualifiedName: qualifiedName("GObject", "ParamSpec"),
                parent: null,
                glibTypeName: "GParam",
                fundamental: true,
                refFunc: "g_param_spec_ref_sink",
                unrefFunc: "g_param_spec_unref",
            });
            gobjectNs.classes.set("ParamSpec", paramSpecClass);
            const namespaces = new Map([["GObject", gobjectNs]]);

            const repo = createMockRepository(namespaces);
            const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "GObject");
            const psFile = fileBuilder();
            const options = {
                namespace: "GObject",
                sharedLibrary: "libgobject-2.0.so.0",
                glibLibrary: "libglib-2.0.so.0",
                gobjectLibrary: "libgobject-2.0.so.0",
            };

            const generator = new ClassGenerator(
                paramSpecClass,
                ffiMapper,
                psFile,
                repo as unknown as GirRepository,
                options,
            );

            generator.generate();

            const code = stringify(psFile);
            expect(code).toContain('"fundamental"');
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
            const adwFile = fileBuilder();
            const options = {
                namespace: "Adw",
                sharedLibrary: "libadwaita-1.so.0",
                glibLibrary: "libglib-2.0.so.0",
                gobjectLibrary: "libgobject-2.0.so.0",
            };

            const generator = new ClassGenerator(
                adwWindowClass,
                ffiMapper,
                adwFile,
                repo as unknown as GirRepository,
                options,
            );

            generator.generate();

            const code = stringify(adwFile);
            expect(code).toContain("extends Gtk.Window");
        });
    });

    describe("interface methods", () => {
        function setupClassImplementingInterface(
            interfaceName: string,
            interfaceMethods: ReturnType<typeof createNormalizedMethod>[],
            ifaceQn = qualifiedName("Gtk", interfaceName),
        ) {
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const widgetClass = createNormalizedClass({
                name: "Widget",
                qualifiedName: qualifiedName("Gtk", "Widget"),
                parent: null,
            });
            const button = createNormalizedClass({
                name: "Button",
                qualifiedName: qualifiedName("Gtk", "Button"),
                parent: qualifiedName("Gtk", "Widget"),
                implements: [ifaceQn],
            });
            gtkNs.classes.set(widgetClass.name, widgetClass);
            gtkNs.classes.set(button.name, button);

            const repo = createMockRepository(new Map([["Gtk", gtkNs]]));
            // biome-ignore lint/suspicious/noExplicitAny: mock repo
            const ifaceMethods = interfaceMethods.map((m) => m as any);
            (repo as unknown as { resolveInterface(qn: string): unknown }).resolveInterface = (qn: string) => {
                if (qn !== ifaceQn) return null;
                return { name: interfaceName, methods: ifaceMethods, properties: [], signals: [] };
            };

            const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
            const file = fileBuilder();
            const options = {
                namespace: "Gtk",
                sharedLibrary: "libgtk-4.so.1",
                glibLibrary: "libglib-2.0.so.0",
                gobjectLibrary: "libgobject-2.0.so.0",
            };

            const generator = new ClassGenerator(button, ffiMapper, file, repo as unknown as GirRepository, options);
            return { generator, file };
        }

        it("emits interface methods on the implementing class", () => {
            const { generator, file } = setupClassImplementingInterface("Orientable", [
                createNormalizedMethod({
                    name: "get_orientation",
                    cIdentifier: "gtk_orientable_get_orientation",
                    returnType: createNormalizedType({ name: "gint" }),
                }),
            ]);

            generator.generate();

            expect(stringify(file)).toContain("getOrientation");
        });

        it("renames interface methods when their name collides across multiple interfaces", () => {
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const widgetClass = createNormalizedClass({
                name: "Widget",
                qualifiedName: qualifiedName("Gtk", "Widget"),
                parent: null,
            });
            const button = createNormalizedClass({
                name: "Button",
                qualifiedName: qualifiedName("Gtk", "Button"),
                parent: qualifiedName("Gtk", "Widget"),
                implements: [qualifiedName("Gtk", "Editable"), qualifiedName("Gtk", "Buildable")],
            });
            gtkNs.classes.set(widgetClass.name, widgetClass);
            gtkNs.classes.set(button.name, button);

            const repo = createMockRepository(new Map([["Gtk", gtkNs]]));
            (repo as unknown as { resolveInterface(qn: string): unknown }).resolveInterface = (qn: string) => {
                if (qn === qualifiedName("Gtk", "Editable")) {
                    return {
                        name: "Editable",
                        methods: [
                            createNormalizedMethod({
                                name: "get_name",
                                cIdentifier: "gtk_editable_get_name",
                                returnType: createNormalizedType({ name: "utf8" }),
                            }),
                        ],
                        properties: [],
                        signals: [],
                    };
                }
                if (qn === qualifiedName("Gtk", "Buildable")) {
                    return {
                        name: "Buildable",
                        methods: [
                            createNormalizedMethod({
                                name: "get_name",
                                cIdentifier: "gtk_buildable_get_name",
                                returnType: createNormalizedType({ name: "utf8" }),
                            }),
                        ],
                        properties: [],
                        signals: [],
                    };
                }
                return null;
            };

            const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
            const file = fileBuilder();
            const options = {
                namespace: "Gtk",
                sharedLibrary: "libgtk-4.so.1",
                glibLibrary: "libglib-2.0.so.0",
                gobjectLibrary: "libgobject-2.0.so.0",
            };

            const generator = new ClassGenerator(button, ffiMapper, file, repo as unknown as GirRepository, options);
            generator.generate();

            const code = stringify(file);
            expect(code).toMatch(/get(?:Editable|Buildable)?Name/);
        });

        it("ignores unresolvable interface entries", () => {
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const widgetClass = createNormalizedClass({
                name: "Widget",
                qualifiedName: qualifiedName("Gtk", "Widget"),
                parent: null,
            });
            const button = createNormalizedClass({
                name: "Button",
                qualifiedName: qualifiedName("Gtk", "Button"),
                parent: qualifiedName("Gtk", "Widget"),
                implements: ["Phantom.Iface"],
            });
            gtkNs.classes.set(widgetClass.name, widgetClass);
            gtkNs.classes.set(button.name, button);

            const repo = createMockRepository(new Map([["Gtk", gtkNs]]));
            const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
            const file = fileBuilder();
            const options = {
                namespace: "Gtk",
                sharedLibrary: "libgtk-4.so.1",
                glibLibrary: "libglib-2.0.so.0",
                gobjectLibrary: "libgobject-2.0.so.0",
            };

            const generator = new ClassGenerator(button, ffiMapper, file, repo as unknown as GirRepository, options);
            const result = generator.generate();
            expect(result).toBeDefined();
        });
    });

    describe("name collisions with parent methods", () => {
        it("emits a renamed method via filterClassMethods when a name collides with a parent", () => {
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const widget = createNormalizedClass({
                name: "Widget",
                qualifiedName: qualifiedName("Gtk", "Widget"),
                parent: null,
                methods: [
                    createNormalizedMethod({
                        name: "get_name",
                        cIdentifier: "gtk_widget_get_name",
                        returnType: createNormalizedType({ name: "utf8" }),
                    }),
                ],
            });
            const button = createNormalizedClass({
                name: "Button",
                qualifiedName: qualifiedName("Gtk", "Button"),
                parent: qualifiedName("Gtk", "Widget"),
                methods: [
                    createNormalizedMethod({
                        name: "get_name",
                        cIdentifier: "gtk_button_get_name",
                        returnType: createNormalizedType({ name: "utf8" }),
                    }),
                ],
            });
            gtkNs.classes.set(widget.name, widget);
            gtkNs.classes.set(button.name, button);

            const repo = createMockRepository(new Map([["Gtk", gtkNs]]));
            const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
            const file = fileBuilder();

            const generator = new ClassGenerator(button, ffiMapper, file, repo as unknown as GirRepository, {
                namespace: "Gtk",
                sharedLibrary: "libgtk-4.so.1",
                glibLibrary: "libglib-2.0.so.0",
                gobjectLibrary: "libgobject-2.0.so.0",
            });

            const result = generator.generate();
            expect(result).toBeDefined();
            expect(stringify(file)).toContain("Button");
        });

        it("renames a method named connect on a class with a parent to avoid the signal helper collision", () => {
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const widget = createNormalizedClass({
                name: "Widget",
                qualifiedName: qualifiedName("Gtk", "Widget"),
                parent: null,
            });
            const socket = createNormalizedClass({
                name: "Socket",
                qualifiedName: qualifiedName("Gtk", "Socket"),
                parent: qualifiedName("Gtk", "Widget"),
                methods: [
                    createNormalizedMethod({
                        name: "connect",
                        cIdentifier: "gtk_socket_connect",
                        returnType: createNormalizedType({ name: "none" }),
                    }),
                ],
            });
            gtkNs.classes.set(widget.name, widget);
            gtkNs.classes.set(socket.name, socket);

            const repo = createMockRepository(new Map([["Gtk", gtkNs]]));
            const ffiMapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
            const file = fileBuilder();

            const generator = new ClassGenerator(socket, ffiMapper, file, repo as unknown as GirRepository, {
                namespace: "Gtk",
                sharedLibrary: "libgtk-4.so.1",
                glibLibrary: "libglib-2.0.so.0",
                gobjectLibrary: "libgobject-2.0.so.0",
            });

            generator.generate();
            const code = stringify(file);
            expect(code).not.toMatch(/^\s*connect\(/m);
        });
    });
});
