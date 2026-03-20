import { describe, expect, it } from "vitest";
import { FfiMapper } from "../../../src/core/type-system/ffi-mapper.js";
import { FFI_INT32, FFI_POINTER, FFI_UINT32, FFI_VOID } from "../../../src/core/type-system/ffi-types.js";
import {
    createNormalizedCallback,
    createNormalizedClass,
    createNormalizedEnumeration,
    createNormalizedInterface,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedRecord,
    createNormalizedType,
    qualifiedName,
} from "../../fixtures/gir-fixtures.js";
import { createMockRepository, type MockGirRepository } from "../../fixtures/mock-repository.js";

function createTestSetup(namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>> = new Map()): {
    repo: MockGirRepository;
    mapper: FfiMapper;
} {
    const repo = createMockRepository(namespaces);
    const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gtk");
    return { repo, mapper };
}

describe("FfiMapper", () => {
    describe("mapType", () => {
        describe("primitives", () => {
            it("maps gint to number and FFI_INT32", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "gint" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("number");
                expect(result.ffi).toEqual(FFI_INT32);
                expect(result.imports).toHaveLength(0);
            });

            it("maps guint to number and FFI_UINT32", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "guint" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("number");
                expect(result.ffi).toEqual(FFI_UINT32);
            });

            it("maps gint64 to number with int/64", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "gint64" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("number");
                expect(result.ffi).toEqual({ type: "int", size: 64, unsigned: false });
            });

            it("maps guint64 to number with int/64 unsigned", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "guint64" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("number");
                expect(result.ffi).toEqual({ type: "int", size: 64, unsigned: true });
            });

            it("maps guint8 to number with int/8 unsigned", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "guint8" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("number");
                expect(result.ffi).toEqual({ type: "int", size: 8, unsigned: true });
            });

            it("maps gfloat to number with float/32", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "gfloat" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("number");
                expect(result.ffi).toEqual({ type: "float", size: 32 });
            });

            it("maps gdouble to number with float/64", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "gdouble" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("number");
                expect(result.ffi).toEqual({ type: "float", size: 64 });
            });

            it("maps gboolean to boolean", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "gboolean" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("boolean");
            });

            it("maps gpointer to number and FFI_POINTER", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "gpointer" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("number");
                expect(result.ffi).toEqual(FFI_POINTER);
            });

            it("maps none to void and FFI_VOID", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "none" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("void");
                expect(result.ffi).toEqual(FFI_VOID);
            });
        });

        describe("strings", () => {
            it("maps utf8 to string", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "utf8" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("string");
                expect(result.ffi.type).toBe("string");
            });

            it("maps filename to string", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "filename" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("string");
                expect(result.ffi.type).toBe("string");
            });

            it("maps utf8 with transfer-full ownership", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "utf8", transferOwnership: "full" });
                const result = mapper.mapType(type);

                expect(result.ffi).toEqual({ type: "string", ownership: "full" });
            });

            it("maps utf8 with transfer-none ownership", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "utf8", transferOwnership: "none" });
                const result = mapper.mapType(type);

                expect(result.ffi).toEqual({ type: "string", ownership: "borrowed" });
            });
        });

        describe("arrays", () => {
            it("maps array of primitives", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({
                    name: "gint",
                    isArray: true,
                    elementType: createNormalizedType({ name: "gint" }),
                });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("number[]");
                expect(result.ffi.type).toBe("array");
            });

            it("maps array of strings", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({
                    name: "utf8",
                    isArray: true,
                    elementType: createNormalizedType({ name: "utf8" }),
                });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("string[]");
            });

            it("maps array without element type to unknown[]", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({
                    name: "gint",
                    isArray: true,
                    elementType: null,
                });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("unknown[]");
            });

            it("recognizes GList arrays", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({
                    name: "gint",
                    isArray: true,
                    cType: "GList*",
                    elementType: createNormalizedType({ name: "gint" }),
                });
                const result = mapper.mapType(type);

                expect(result.ffi.type).toBe("array");
                if (result.ffi.type === "array") {
                    expect(result.ffi.kind).toBe("glist");
                }
            });

            it("recognizes GSList arrays", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({
                    name: "gint",
                    isArray: true,
                    cType: "GSList*",
                    elementType: createNormalizedType({ name: "gint" }),
                });
                const result = mapper.mapType(type);

                expect(result.ffi.type).toBe("array");
                if (result.ffi.type === "array") {
                    expect(result.ffi.kind).toBe("gslist");
                }
            });

            it("maps GHashTable to Map<K, V>", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({
                    name: qualifiedName("GLib", "HashTable"),
                    isArray: false,
                    containerType: "ghashtable",
                    typeParameters: [createNormalizedType({ name: "utf8" }), createNormalizedType({ name: "gint" })],
                });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("Map<string, number>");
                expect(result.ffi.type).toBe("hashtable");
            });

            it("maps GHashTable without type params to Map<unknown, unknown>", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({
                    name: qualifiedName("GLib", "HashTable"),
                    isArray: false,
                    containerType: "ghashtable",
                    typeParameters: [],
                });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("Map<unknown, unknown>");
            });

            it("maps GPtrArray to T[]", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({
                    name: qualifiedName("GLib", "PtrArray"),
                    isArray: true,
                    containerType: "gptrarray",
                    elementType: createNormalizedType({ name: "utf8" }),
                });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("string[]");
                expect(result.ffi.type).toBe("array");
                if (result.ffi.type === "array") {
                    expect(result.ffi.kind).toBe("gptrarray");
                }
            });

            it("maps GArray to T[] with element size", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({
                    name: qualifiedName("GLib", "Array"),
                    isArray: true,
                    containerType: "garray",
                    elementType: createNormalizedType({ name: "gint" }),
                });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("number[]");
                expect(result.ffi.type).toBe("array");
                if (result.ffi.type === "array") {
                    expect(result.ffi.kind).toBe("garray");
                    expect(result.ffi.elementSize).toBeDefined();
                }
            });

            it("maps GList with containerType", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({
                    name: "array",
                    isArray: true,
                    containerType: "glist",
                    elementType: createNormalizedType({ name: "utf8" }),
                });
                const result = mapper.mapType(type);

                expect(result.ffi.type).toBe("array");
                if (result.ffi.type === "array") {
                    expect(result.ffi.kind).toBe("glist");
                }
            });

            it("maps GSList with containerType", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({
                    name: "array",
                    isArray: true,
                    containerType: "gslist",
                    elementType: createNormalizedType({ name: "utf8" }),
                });
                const result = mapper.mapType(type);

                expect(result.ffi.type).toBe("array");
                if (result.ffi.type === "array") {
                    expect(result.ffi.kind).toBe("gslist");
                }
            });
        });

        describe("classes", () => {
            it("maps class from same namespace", () => {
                const buttonClass = createNormalizedClass({ name: "Button" });
                const ns = createNormalizedNamespace({
                    name: "Gtk",
                    classes: new Map([["Button", buttonClass]]),
                });
                const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

                const type = createNormalizedType({ name: "Button" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("Button");
                expect(result.ffi.type).toBe("gobject");
                expect(result.kind).toBe("class");
                expect(result.imports).toHaveLength(1);
                expect(result.imports[0]).toMatchObject({
                    kind: "class",
                    name: "Button",
                    namespace: "Gtk",
                    isExternal: false,
                });
            });

            it("maps class from external namespace", () => {
                const appClass = createNormalizedClass({
                    name: "Application",
                    qualifiedName: qualifiedName("Gio", "Application"),
                });
                const gioNs = createNormalizedNamespace({
                    name: "Gio",
                    classes: new Map([["Application", appClass]]),
                });
                const gtkNs = createNormalizedNamespace({ name: "Gtk" });

                const { mapper } = createTestSetup(
                    new Map([
                        ["Gio", gioNs],
                        ["Gtk", gtkNs],
                    ]),
                );

                const type = createNormalizedType({ name: "Gio.Application" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("Gio.Application");
                expect(result.ffi.type).toBe("gobject");
                expect(result.imports[0]).toMatchObject({
                    kind: "class",
                    name: "Application",
                    namespace: "Gio",
                    isExternal: true,
                });
            });

            it("maps skipped class to unknown", () => {
                const buttonClass = createNormalizedClass({ name: "Button" });
                const ns = createNormalizedNamespace({
                    name: "Gtk",
                    classes: new Map([["Button", buttonClass]]),
                });
                const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

                mapper.registerSkippedClass("Button");
                const type = createNormalizedType({ name: "Button" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("unknown");
            });

            it("clears skipped classes", () => {
                const buttonClass = createNormalizedClass({ name: "Button" });
                const ns = createNormalizedNamespace({
                    name: "Gtk",
                    classes: new Map([["Button", buttonClass]]),
                });
                const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

                mapper.registerSkippedClass("Button");
                mapper.clearSkippedClasses();
                const type = createNormalizedType({ name: "Button" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("Button");
            });
        });

        describe("interfaces", () => {
            it("maps interface type", () => {
                const iface = createNormalizedInterface({ name: "Orientable" });
                const ns = createNormalizedNamespace({
                    name: "Gtk",
                    interfaces: new Map([["Orientable", iface]]),
                });
                const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

                const type = createNormalizedType({ name: "Orientable" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("Orientable");
                expect(result.ffi.type).toBe("gobject");
                expect(result.kind).toBe("interface");
            });
        });

        describe("records", () => {
            it("maps record with GType to boxed type", () => {
                const record = createNormalizedRecord({
                    name: "Rectangle",
                    qualifiedName: qualifiedName("Gdk", "Rectangle"),
                    glibTypeName: "GdkRectangle",
                    glibGetType: "gdk_rectangle_get_type",
                });
                const ns = createNormalizedNamespace({
                    name: "Gdk",
                    sharedLibrary: "libgtk-4.so.1",
                    records: new Map([["Rectangle", record]]),
                });
                const repo = createMockRepository(new Map([["Gdk", ns]]));
                const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gdk");

                const type = createNormalizedType({ name: "Rectangle" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("Rectangle");
                expect(result.ffi.type).toBe("boxed");
                expect(result.kind).toBe("record");
            });

            it("maps plain struct record to struct type", () => {
                const record = createNormalizedRecord({
                    name: "Color",
                    qualifiedName: qualifiedName("Gdk", "Color"),
                });
                const ns = createNormalizedNamespace({
                    name: "Gdk",
                    records: new Map([["Color", record]]),
                });
                const repo = createMockRepository(new Map([["Gdk", ns]]));
                const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gdk");

                const type = createNormalizedType({ name: "Color" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("Color");
                expect(result.ffi.type).toBe("struct");
            });

            it("maps records with copy/free functions as fundamental", () => {
                const variant = createNormalizedRecord({
                    name: "Variant",
                    qualifiedName: qualifiedName("GLib", "Variant"),
                    glibTypeName: "GVariant",
                    glibGetType: "g_variant_get_type",
                    copyFunction: "g_variant_ref_sink",
                    freeFunction: "g_variant_unref",
                });
                const glibNs = createNormalizedNamespace({
                    name: "GLib",
                    sharedLibrary: "libglib-2.0.so.0",
                    records: new Map([["Variant", variant]]),
                });
                const repo = createMockRepository(new Map([["GLib", glibNs]]));
                const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "GLib");

                const type = createNormalizedType({ name: "Variant" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("Variant");
                expect(result.ffi.type).toBe("fundamental");
            });
        });

        describe("enums and flags", () => {
            it("maps enum to FFI_INT32", () => {
                const enumType = createNormalizedEnumeration({ name: "Orientation" });
                const ns = createNormalizedNamespace({
                    name: "Gtk",
                    enumerations: new Map([["Orientation", enumType]]),
                });
                const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

                const type = createNormalizedType({ name: "Orientation" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("Orientation");
                expect(result.ffi).toEqual(FFI_INT32);
                expect(result.kind).toBe("enum");
            });

            it("maps flags (bitfield) to FFI_UINT32", () => {
                const flags = createNormalizedEnumeration({ name: "StateFlags" });
                const ns = createNormalizedNamespace({
                    name: "Gtk",
                    bitfields: new Map([["StateFlags", flags]]),
                });
                const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

                const type = createNormalizedType({ name: "StateFlags" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("StateFlags");
                expect(result.ffi).toEqual(FFI_UINT32);
                expect(result.kind).toBe("flags");
            });
        });

        describe("callbacks", () => {
            it("maps callback type to pointer", () => {
                const callback = createNormalizedCallback({ name: "TickCallback" });
                const ns = createNormalizedNamespace({
                    name: "Gtk",
                    callbacks: new Map([["TickCallback", callback]]),
                });
                const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

                const type = createNormalizedType({ name: "TickCallback" });
                const result = mapper.mapType(type);

                expect(result.ffi).toEqual(FFI_POINTER);
                expect(result.kind).toBe("callback");
            });
        });

        describe("GObject.ParamSpec", () => {
            it("maps ParamSpec as fundamental type", () => {
                const paramSpec = createNormalizedClass({
                    name: "ParamSpec",
                    qualifiedName: qualifiedName("GObject", "ParamSpec"),
                    glibTypeName: "GParam",
                    fundamental: true,
                    refFunc: "g_param_spec_ref_sink",
                    unrefFunc: "g_param_spec_unref",
                });
                const gobjectNs = createNormalizedNamespace({
                    name: "GObject",
                    sharedLibrary: "libgobject-2.0.so.0",
                    classes: new Map([["ParamSpec", paramSpec]]),
                });
                const gtkNs = createNormalizedNamespace({ name: "Gtk" });
                const { mapper } = createTestSetup(
                    new Map([
                        ["GObject", gobjectNs],
                        ["Gtk", gtkNs],
                    ]),
                );

                const type = createNormalizedType({ name: "GObject.ParamSpec" });
                const result = mapper.mapType(type);

                expect(result.ffi.type).toBe("fundamental");
            });
        });

        describe("unknown types", () => {
            it("maps unknown type to number/pointer", () => {
                const { mapper } = createTestSetup();
                const type = createNormalizedType({ name: "SomeUnknownType" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("number");
                expect(result.ffi).toEqual(FFI_POINTER);
            });
        });
    });

    describe("mapParameter", () => {
        describe("out parameters", () => {
            it("wraps out parameter in Ref<>", () => {
                const { mapper } = createTestSetup();
                const param = createNormalizedParameter({
                    name: "result",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "out",
                });
                const result = mapper.mapParameter(param);

                expect(result.ts).toBe("Ref<number>");
                expect(result.ffi.type).toBe("ref");
                expect(result.innerTsType).toBe("number");
            });

            it("wraps inout parameter in Ref<>", () => {
                const { mapper } = createTestSetup();
                const param = createNormalizedParameter({
                    name: "value",
                    type: createNormalizedType({ name: "gint" }),
                    direction: "inout",
                });
                const result = mapper.mapParameter(param);

                expect(result.ts).toBe("Ref<number>");
                expect(result.ffi.type).toBe("ref");
            });

            it("handles caller-allocates for boxed types without Ref", () => {
                const record = createNormalizedRecord({
                    name: "Rectangle",
                    qualifiedName: qualifiedName("Gdk", "Rectangle"),
                    glibTypeName: "GdkRectangle",
                    glibGetType: "gdk_rectangle_get_type",
                });
                const ns = createNormalizedNamespace({
                    name: "Gdk",
                    sharedLibrary: "libgtk-4.so.1",
                    records: new Map([["Rectangle", record]]),
                });
                const repo = createMockRepository(new Map([["Gdk", ns]]));
                const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gdk");

                const param = createNormalizedParameter({
                    name: "rect",
                    type: createNormalizedType({ name: "Rectangle" }),
                    direction: "out",
                    callerAllocates: true,
                });
                const result = mapper.mapParameter(param);

                expect(result.ts).toBe("Rectangle");
                expect(result.ffi.type).toBe("boxed");
            });
        });

        describe("ownership transfer", () => {
            it("sets ownership to full for transfer-full", () => {
                const buttonClass = createNormalizedClass({ name: "Button" });
                const ns = createNormalizedNamespace({
                    name: "Gtk",
                    classes: new Map([["Button", buttonClass]]),
                });
                const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

                const param = createNormalizedParameter({
                    name: "widget",
                    type: createNormalizedType({ name: "Button" }),
                    transferOwnership: "full",
                });
                const result = mapper.mapParameter(param);

                expect(result.ffi.type).toBe("gobject");
                if (result.ffi.type === "gobject") {
                    expect(result.ffi.ownership).toBe("full");
                }
            });

            it("sets ownership to borrowed for transfer-none", () => {
                const buttonClass = createNormalizedClass({ name: "Button" });
                const ns = createNormalizedNamespace({
                    name: "Gtk",
                    classes: new Map([["Button", buttonClass]]),
                });
                const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

                const param = createNormalizedParameter({
                    name: "widget",
                    type: createNormalizedType({ name: "Button" }),
                    transferOwnership: "none",
                });
                const result = mapper.mapParameter(param);

                expect(result.ffi.type).toBe("gobject");
                if (result.ffi.type === "gobject") {
                    expect(result.ffi.ownership).toBe("borrowed");
                }
            });
        });

        describe("callbacks in parameters", () => {
            it("maps supported callback with native implementation", () => {
                const asyncCallback = createNormalizedCallback({
                    name: "AsyncReadyCallback",
                    qualifiedName: qualifiedName("Gio", "AsyncReadyCallback"),
                    parameters: [
                        createNormalizedParameter({
                            name: "source_object",
                            type: createNormalizedType({ name: "GObject.Object" }),
                        }),
                        createNormalizedParameter({
                            name: "res",
                            type: createNormalizedType({ name: "Gio.AsyncResult" }),
                        }),
                        createNormalizedParameter({
                            name: "user_data",
                            type: createNormalizedType({ name: "gpointer" }),
                        }),
                    ],
                    returnType: createNormalizedType({ name: "none" }),
                });
                const gioNs = createNormalizedNamespace({
                    name: "Gio",
                    callbacks: new Map([["AsyncReadyCallback", asyncCallback]]),
                });
                const gtkNs = createNormalizedNamespace({ name: "Gtk" });
                const { mapper } = createTestSetup(
                    new Map([
                        ["Gio", gioNs],
                        ["Gtk", gtkNs],
                    ]),
                );

                const param = createNormalizedParameter({
                    name: "callback",
                    type: createNormalizedType({ name: "Gio.AsyncReadyCallback" }),
                });
                const result = mapper.mapParameter(param);

                expect(result.ffi.type).toBe("trampoline");
                if (result.ffi.type === "trampoline") {
                    expect(result.ffi.argTypes).toBeDefined();
                    expect(result.ffi.returnType).toBeDefined();
                }
            });

            it("maps GLib.Closure to generic callback", () => {
                const { mapper } = createTestSetup();
                const param = createNormalizedParameter({
                    name: "callback",
                    type: createNormalizedType({ name: "GLib.Closure" }),
                });
                const result = mapper.mapParameter(param);

                expect(result.ts).toBe("(...args: unknown[]) => unknown");
                expect(result.ffi.type).toBe("callback");
            });
        });
    });

    describe("isCallback", () => {
        it("returns true for callback in current namespace", () => {
            const callback = createNormalizedCallback({ name: "TickCallback" });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                callbacks: new Map([["TickCallback", callback]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            expect(mapper.isCallback("TickCallback")).toBe(true);
        });

        it("returns true for qualified callback", () => {
            const callback = createNormalizedCallback({
                name: "AsyncReadyCallback",
                qualifiedName: qualifiedName("Gio", "AsyncReadyCallback"),
            });
            const gioNs = createNormalizedNamespace({
                name: "Gio",
                callbacks: new Map([["AsyncReadyCallback", callback]]),
            });
            const { mapper } = createTestSetup(new Map([["Gio", gioNs]]));

            expect(mapper.isCallback("Gio.AsyncReadyCallback")).toBe(true);
        });

        it("returns false for non-callback type", () => {
            const { mapper } = createTestSetup();
            expect(mapper.isCallback("Button")).toBe(false);
        });
    });

    describe("isClosureTarget", () => {
        it("returns true for user_data parameter of supported callback", () => {
            const asyncCallback = createNormalizedCallback({
                name: "AsyncReadyCallback",
                qualifiedName: qualifiedName("Gio", "AsyncReadyCallback"),
            });
            const gioNs = createNormalizedNamespace({
                name: "Gio",
                callbacks: new Map([["AsyncReadyCallback", asyncCallback]]),
            });
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const { mapper } = createTestSetup(
                new Map([
                    ["Gio", gioNs],
                    ["Gtk", gtkNs],
                ]),
            );

            const callbackParam = createNormalizedParameter({
                name: "callback",
                type: createNormalizedType({ name: "Gio.AsyncReadyCallback" }),
                closure: 1,
            });
            const userDataParam = createNormalizedParameter({
                name: "user_data",
                type: createNormalizedType({ name: "gpointer" }),
            });
            const allParams = [callbackParam, userDataParam];

            expect(mapper.isClosureTarget(userDataParam, allParams)).toBe(true);
            expect(mapper.isClosureTarget(callbackParam, allParams)).toBe(false);
        });
    });

    describe("isNullable", () => {
        it("returns true for nullable parameter", () => {
            const { mapper } = createTestSetup();
            const param = createNormalizedParameter({ nullable: true });
            expect(mapper.isNullable(param)).toBe(true);
        });

        it("returns true for optional parameter", () => {
            const { mapper } = createTestSetup();
            const param = createNormalizedParameter({ optional: true });
            expect(mapper.isNullable(param)).toBe(true);
        });

        it("returns false for required parameter", () => {
            const { mapper } = createTestSetup();
            const param = createNormalizedParameter({ nullable: false, optional: false });
            expect(mapper.isNullable(param)).toBe(false);
        });
    });

    describe("hasUnsupportedCallback", () => {
        it("returns false for supported callback", () => {
            const asyncCallback = createNormalizedCallback({
                name: "AsyncReadyCallback",
                qualifiedName: qualifiedName("Gio", "AsyncReadyCallback"),
            });
            const gioNs = createNormalizedNamespace({
                name: "Gio",
                callbacks: new Map([["AsyncReadyCallback", asyncCallback]]),
            });
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const { mapper } = createTestSetup(
                new Map([
                    ["Gio", gioNs],
                    ["Gtk", gtkNs],
                ]),
            );

            const param = createNormalizedParameter({
                name: "callback",
                type: createNormalizedType({ name: "Gio.AsyncReadyCallback" }),
            });
            expect(mapper.hasUnsupportedCallback(param)).toBe(false);
        });

        it("returns false for any GIR callback (all are now supported)", () => {
            const customCallback = createNormalizedCallback({
                name: "CustomCallback",
                qualifiedName: qualifiedName("Gtk", "CustomCallback"),
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                callbacks: new Map([["CustomCallback", customCallback]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const param = createNormalizedParameter({
                name: "callback",
                type: createNormalizedType({ name: "CustomCallback" }),
            });
            expect(mapper.hasUnsupportedCallback(param)).toBe(false);
        });

        it("returns true for GLib.Closure", () => {
            const { mapper } = createTestSetup();
            const param = createNormalizedParameter({
                name: "closure",
                type: createNormalizedType({ name: "GLib.Closure" }),
            });
            expect(mapper.hasUnsupportedCallback(param)).toBe(true);
        });
    });
});

describe("FfiMapper - Extended Coverage", () => {
    describe("mapParameter - out/inout for all type kinds", () => {
        it("wraps out string parameter in Ref<>", () => {
            const { mapper } = createTestSetup();
            const param = createNormalizedParameter({
                name: "result",
                type: createNormalizedType({ name: "utf8" }),
                direction: "out",
            });
            const result = mapper.mapParameter(param);

            expect(result.ts).toBe("Ref<string>");
            expect(result.ffi.type).toBe("ref");
            expect(result.innerTsType).toBe("string");
        });

        it("wraps out enum parameter in Ref<>", () => {
            const enumType = createNormalizedEnumeration({ name: "Orientation" });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                enumerations: new Map([["Orientation", enumType]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const param = createNormalizedParameter({
                name: "result",
                type: createNormalizedType({ name: "Orientation" }),
                direction: "out",
            });
            const result = mapper.mapParameter(param);

            expect(result.ts).toBe("Ref<Orientation>");
            expect(result.ffi.type).toBe("ref");
            expect(result.innerTsType).toBe("Orientation");
        });

        it("wraps out flags parameter in Ref<>", () => {
            const flags = createNormalizedEnumeration({ name: "StateFlags" });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                bitfields: new Map([["StateFlags", flags]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const param = createNormalizedParameter({
                name: "result",
                type: createNormalizedType({ name: "StateFlags" }),
                direction: "out",
            });
            const result = mapper.mapParameter(param);

            expect(result.ts).toBe("Ref<StateFlags>");
            expect(result.ffi.type).toBe("ref");
        });

        it("wraps out array parameter in Ref<>", () => {
            const { mapper } = createTestSetup();
            const param = createNormalizedParameter({
                name: "result",
                type: createNormalizedType({
                    name: "gint",
                    isArray: true,
                    elementType: createNormalizedType({ name: "gint" }),
                }),
                direction: "out",
            });
            const result = mapper.mapParameter(param);

            expect(result.ts).toBe("Ref<number[]>");
            expect(result.ffi.type).toBe("ref");
            expect(result.innerTsType).toBe("number[]");
        });

        it("handles out GObject without Ref when caller-allocates", () => {
            const buttonClass = createNormalizedClass({ name: "Button" });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", buttonClass]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const param = createNormalizedParameter({
                name: "widget",
                type: createNormalizedType({ name: "Button" }),
                direction: "out",
                callerAllocates: true,
            });
            const result = mapper.mapParameter(param);

            expect(result.ts).toBe("Button");
            expect(result.ffi.type).toBe("gobject");
            expect(result.ffi.ownership).toBe("borrowed");
        });

        it("handles inout GObject without Ref", () => {
            const buttonClass = createNormalizedClass({ name: "Button" });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", buttonClass]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const param = createNormalizedParameter({
                name: "widget",
                type: createNormalizedType({ name: "Button" }),
                direction: "inout",
            });
            const result = mapper.mapParameter(param);

            expect(result.ts).toBe("Button");
            expect(result.ffi.type).toBe("gobject");
        });

        it("handles out struct without Ref when caller-allocates", () => {
            const record = createNormalizedRecord({
                name: "Color",
                qualifiedName: qualifiedName("Gdk", "Color"),
            });
            const ns = createNormalizedNamespace({
                name: "Gdk",
                records: new Map([["Color", record]]),
            });
            const repo = createMockRepository(new Map([["Gdk", ns]]));
            const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gdk");

            const param = createNormalizedParameter({
                name: "color",
                type: createNormalizedType({ name: "Color" }),
                direction: "out",
                callerAllocates: true,
            });
            const result = mapper.mapParameter(param);

            expect(result.ts).toBe("Color");
            expect(result.ffi.type).toBe("struct");
        });

        it("wraps out primitive (gint64) in Ref<>", () => {
            const { mapper } = createTestSetup();
            const param = createNormalizedParameter({
                name: "count",
                type: createNormalizedType({ name: "gint64" }),
                direction: "out",
            });
            const result = mapper.mapParameter(param);

            expect(result.ts).toBe("Ref<number>");
            expect(result.ffi.type).toBe("ref");
        });

        it("wraps out float in Ref<>", () => {
            const { mapper } = createTestSetup();
            const param = createNormalizedParameter({
                name: "value",
                type: createNormalizedType({ name: "gfloat" }),
                direction: "out",
            });
            const result = mapper.mapParameter(param);

            expect(result.ts).toBe("Ref<number>");
            expect(result.ffi.type).toBe("ref");
            if (result.ffi.type === "ref") {
                expect(result.ffi.innerType).toEqual({ type: "float", size: 32 });
            }
        });

        it("wraps out boolean in Ref<>", () => {
            const { mapper } = createTestSetup();
            const param = createNormalizedParameter({
                name: "success",
                type: createNormalizedType({ name: "gboolean" }),
                direction: "out",
            });
            const result = mapper.mapParameter(param);

            expect(result.ts).toBe("Ref<boolean>");
            expect(result.ffi.type).toBe("ref");
        });
    });

    describe("mapType - transfer ownership comprehensive", () => {
        it("maps string with transfer-container as full ownership", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({ name: "utf8", transferOwnership: "container" });
            const result = mapper.mapType(type);

            expect(result.ffi).toEqual({ type: "string", ownership: "full" });
        });

        it("maps GObject array with container transfer", () => {
            const buttonClass = createNormalizedClass({ name: "Button" });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", buttonClass]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const type = createNormalizedType({
                name: "Button",
                isArray: true,
                elementType: createNormalizedType({ name: "Button" }),
                transferOwnership: "container",
            });
            const result = mapper.mapType(type);

            expect(result.ffi.type).toBe("array");
            expect(result.ffi.ownership).toBe("full");
        });

        it("maps boxed type with transfer-full", () => {
            const record = createNormalizedRecord({
                name: "Rectangle",
                qualifiedName: qualifiedName("Gdk", "Rectangle"),
                glibTypeName: "GdkRectangle",
                glibGetType: "gdk_rectangle_get_type",
            });
            const ns = createNormalizedNamespace({
                name: "Gdk",
                sharedLibrary: "libgtk-4.so.1",
                records: new Map([["Rectangle", record]]),
            });
            const repo = createMockRepository(new Map([["Gdk", ns]]));
            const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gdk");

            const type = createNormalizedType({ name: "Rectangle", transferOwnership: "full" });
            const result = mapper.mapType(type);

            expect(result.ffi.type).toBe("boxed");
            expect(result.ffi.ownership).toBe("full");
        });

        it("maps boxed type with transfer-none", () => {
            const record = createNormalizedRecord({
                name: "Rectangle",
                qualifiedName: qualifiedName("Gdk", "Rectangle"),
                glibTypeName: "GdkRectangle",
                glibGetType: "gdk_rectangle_get_type",
            });
            const ns = createNormalizedNamespace({
                name: "Gdk",
                sharedLibrary: "libgtk-4.so.1",
                records: new Map([["Rectangle", record]]),
            });
            const repo = createMockRepository(new Map([["Gdk", ns]]));
            const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "Gdk");

            const type = createNormalizedType({ name: "Rectangle", transferOwnership: "none" });
            const result = mapper.mapType(type, true);

            expect(result.ffi.type).toBe("boxed");
            expect(result.ffi.ownership).toBe("borrowed");
        });

        it("maps hashtable with transfer-full", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: qualifiedName("GLib", "HashTable"),
                isArray: false,
                containerType: "ghashtable",
                typeParameters: [createNormalizedType({ name: "utf8" }), createNormalizedType({ name: "gint" })],
                transferOwnership: "full",
            });
            const result = mapper.mapType(type);

            expect(result.ffi.type).toBe("hashtable");
            expect(result.ffi.ownership).toBe("full");
        });

        it("maps hashtable with transfer-none as borrowed for returns", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: qualifiedName("GLib", "HashTable"),
                isArray: false,
                containerType: "ghashtable",
                typeParameters: [createNormalizedType({ name: "utf8" }), createNormalizedType({ name: "gint" })],
                transferOwnership: "none",
            });
            const result = mapper.mapType(type, true);

            expect(result.ffi.type).toBe("hashtable");
            expect(result.ffi.ownership).toBe("borrowed");
        });

        it("uses default full ownership for GObject non-return parameters", () => {
            const buttonClass = createNormalizedClass({ name: "Button" });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", buttonClass]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const type = createNormalizedType({
                name: "Button",
            });
            const result = mapper.mapType(type, false);

            expect(result.ffi.ownership).toBe("full");
        });

        it("uses default borrowed ownership for GObject return types", () => {
            const buttonClass = createNormalizedClass({ name: "Button" });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", buttonClass]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const type = createNormalizedType({
                name: "Button",
            });
            const result = mapper.mapType(type, true);

            expect(result.ffi.ownership).toBe("borrowed");
        });
    });

    describe("mapType - array edge cases", () => {
        it("maps fixed-size array correctly", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: "gint",
                isArray: true,
                elementType: createNormalizedType({ name: "gint" }),
                fixedSize: 4,
            });
            const result = mapper.mapType(type);

            expect(result.ts).toBe("number[]");
            expect(result.ffi.type).toBe("array");
            expect(result.ffi.kind).toBe("fixed");
            expect(result.ffi.fixedSize).toBe(4);
        });

        it("maps sized array with size param index", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: "gint",
                isArray: true,
                elementType: createNormalizedType({ name: "gint" }),
                sizeParamIndex: 1,
                zeroTerminated: false,
            });
            const result = mapper.mapType(type);

            expect(result.ffi.type).toBe("array");
            expect(result.ffi.kind).toBe("sized");
            expect(result.ffi.sizeParamIndex).toBe(1);
        });

        it("adjusts size param index with offset for instance methods", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: "gint",
                isArray: true,
                elementType: createNormalizedType({ name: "gint" }),
                sizeParamIndex: 0,
                zeroTerminated: false,
            });
            const result = mapper.mapType(type, false, undefined, 1);

            expect(result.ffi.sizeParamIndex).toBe(1);
        });

        it("maps array of strings with element ownership", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: "utf8",
                isArray: true,
                elementType: createNormalizedType({ name: "utf8" }),
                transferOwnership: "full",
            });
            const result = mapper.mapType(type);

            expect(result.ts).toBe("string[]");
            expect(result.ffi.type).toBe("array");
            expect(result.ffi.ownership).toBe("full");
            if (result.ffi.itemType) {
                expect(result.ffi.itemType.type).toBe("string");
            }
        });

        it("maps array of GObjects with transfer-none", () => {
            const buttonClass = createNormalizedClass({ name: "Button" });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", buttonClass]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const type = createNormalizedType({
                name: "Button",
                isArray: true,
                elementType: createNormalizedType({ name: "Button" }),
                transferOwnership: "none",
            });
            const result = mapper.mapType(type, true);

            expect(result.ts).toBe("Button[]");
            expect(result.ffi.type).toBe("array");
            expect(result.ffi.ownership).toBe("borrowed");
        });

        it("maps fixed-size array of doubles", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: "gdouble",
                isArray: true,
                elementType: createNormalizedType({ name: "gdouble" }),
                fixedSize: 16,
            });
            const result = mapper.mapType(type);

            expect(result.ts).toBe("number[]");
            expect(result.ffi.kind).toBe("fixed");
            expect(result.ffi.fixedSize).toBe(16);
            if (result.ffi.itemType) {
                expect(result.ffi.itemType.type).toBe("float");
                expect(result.ffi.itemType.size).toBe(64);
            }
        });

        it("maps GPtrArray with GObject elements", () => {
            const buttonClass = createNormalizedClass({ name: "Button" });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", buttonClass]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const type = createNormalizedType({
                name: qualifiedName("GLib", "PtrArray"),
                isArray: true,
                containerType: "gptrarray",
                elementType: createNormalizedType({ name: "Button" }),
            });
            const result = mapper.mapType(type);

            expect(result.ts).toBe("Button[]");
            expect(result.ffi.type).toBe("array");
            expect(result.ffi.kind).toBe("gptrarray");
        });

        it("maps GArray with sized elements", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: qualifiedName("GLib", "Array"),
                isArray: true,
                containerType: "garray",
                elementType: createNormalizedType({ name: "guint32" }),
            });
            const result = mapper.mapType(type);

            expect(result.ts).toBe("number[]");
            expect(result.ffi.type).toBe("array");
            expect(result.ffi.kind).toBe("garray");
            expect(result.ffi.elementSize).toBe(4);
        });

        it("maps zero-terminated array (not sized)", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: "utf8",
                isArray: true,
                elementType: createNormalizedType({ name: "utf8" }),
                zeroTerminated: true,
            });
            const result = mapper.mapType(type);

            expect(result.ffi.type).toBe("array");
            expect(result.ffi.kind).toBe("array");
            expect(result.ffi.sizeParamIndex).toBeUndefined();
        });
    });

    describe("mapType - hashtable edge cases", () => {
        it("maps hashtable with GObject values", () => {
            const buttonClass = createNormalizedClass({ name: "Button" });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", buttonClass]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const type = createNormalizedType({
                name: qualifiedName("GLib", "HashTable"),
                isArray: false,
                containerType: "ghashtable",
                typeParameters: [createNormalizedType({ name: "utf8" }), createNormalizedType({ name: "Button" })],
            });
            const result = mapper.mapType(type);

            expect(result.ts).toBe("Map<string, Button>");
            expect(result.ffi.type).toBe("hashtable");
            if (result.ffi.valueType) {
                expect(result.ffi.valueType.type).toBe("gobject");
            }
        });

        it("maps hashtable with numeric keys", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: qualifiedName("GLib", "HashTable"),
                isArray: false,
                containerType: "ghashtable",
                typeParameters: [createNormalizedType({ name: "gint" }), createNormalizedType({ name: "utf8" })],
            });
            const result = mapper.mapType(type);

            expect(result.ts).toBe("Map<number, string>");
            if (result.ffi.keyType) {
                expect(result.ffi.keyType.type).toBe("int");
            }
        });

        it("maps hashtable with enum values", () => {
            const enumType = createNormalizedEnumeration({ name: "Orientation" });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                enumerations: new Map([["Orientation", enumType]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const type = createNormalizedType({
                name: qualifiedName("GLib", "HashTable"),
                isArray: false,
                containerType: "ghashtable",
                typeParameters: [createNormalizedType({ name: "utf8" }), createNormalizedType({ name: "Orientation" })],
            });
            const result = mapper.mapType(type);

            expect(result.ts).toBe("Map<string, Orientation>");
        });

        it("maps hashtable with boolean values", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: qualifiedName("GLib", "HashTable"),
                isArray: false,
                containerType: "ghashtable",
                typeParameters: [createNormalizedType({ name: "utf8" }), createNormalizedType({ name: "gboolean" })],
            });
            const result = mapper.mapType(type);

            expect(result.ts).toBe("Map<string, boolean>");
            expect(result.ffi.type).toBe("hashtable");
            if (result.ffi.valueType) {
                expect(result.ffi.valueType.type).toBe("boolean");
            }
        });

        it("maps hashtable with boolean keys", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: qualifiedName("GLib", "HashTable"),
                isArray: false,
                containerType: "ghashtable",
                typeParameters: [createNormalizedType({ name: "gboolean" }), createNormalizedType({ name: "utf8" })],
            });
            const result = mapper.mapType(type);

            expect(result.ts).toBe("Map<boolean, string>");
            expect(result.ffi.type).toBe("hashtable");
            if (result.ffi.keyType) {
                expect(result.ffi.keyType.type).toBe("boolean");
            }
        });

        it("maps hashtable with float values", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: qualifiedName("GLib", "HashTable"),
                isArray: false,
                containerType: "ghashtable",
                typeParameters: [createNormalizedType({ name: "utf8" }), createNormalizedType({ name: "gdouble" })],
            });
            const result = mapper.mapType(type);

            expect(result.ts).toBe("Map<string, number>");
            expect(result.ffi.type).toBe("hashtable");
            if (result.ffi.valueType) {
                expect(result.ffi.valueType.type).toBe("float");
                expect(result.ffi.valueType.size).toBe(64);
            }
        });

        it("maps hashtable with float keys", () => {
            const { mapper } = createTestSetup();
            const type = createNormalizedType({
                name: qualifiedName("GLib", "HashTable"),
                isArray: false,
                containerType: "ghashtable",
                typeParameters: [createNormalizedType({ name: "gfloat" }), createNormalizedType({ name: "gint" })],
            });
            const result = mapper.mapType(type);

            expect(result.ts).toBe("Map<number, number>");
            expect(result.ffi.type).toBe("hashtable");
            if (result.ffi.keyType) {
                expect(result.ffi.keyType.type).toBe("float");
                expect(result.ffi.keyType.size).toBe(32);
            }
        });
    });

    describe("mapType - fundamental types", () => {
        it("maps fundamental class with ref/unref functions", () => {
            const fundamentalClass = createNormalizedClass({
                name: "ParamSpec",
                qualifiedName: qualifiedName("GObject", "ParamSpec"),
                glibTypeName: "GParam",
                fundamental: true,
                refFunc: "g_param_spec_ref_sink",
                unrefFunc: "g_param_spec_unref",
            });
            const gobjectNs = createNormalizedNamespace({
                name: "GObject",
                sharedLibrary: "libgobject-2.0.so.0",
                classes: new Map([["ParamSpec", fundamentalClass]]),
            });
            const { mapper } = createTestSetup(new Map([["GObject", gobjectNs]]));

            const type = createNormalizedType({ name: "GObject.ParamSpec", transferOwnership: "full" });
            const result = mapper.mapType(type);

            expect(result.ffi.type).toBe("fundamental");
            expect(result.ffi.refFn).toBe("g_param_spec_ref_sink");
            expect(result.ffi.unrefFn).toBe("g_param_spec_unref");
            expect(result.ffi.ownership).toBe("full");
        });

        it("maps fundamental record with copy/free functions", () => {
            const variant = createNormalizedRecord({
                name: "Variant",
                qualifiedName: qualifiedName("GLib", "Variant"),
                glibTypeName: "GVariant",
                glibGetType: "g_variant_get_type",
                copyFunction: "g_variant_ref_sink",
                freeFunction: "g_variant_unref",
            });
            const glibNs = createNormalizedNamespace({
                name: "GLib",
                sharedLibrary: "libglib-2.0.so.0",
                records: new Map([["Variant", variant]]),
            });
            const repo = createMockRepository(new Map([["GLib", glibNs]]));
            const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "GLib");

            const type = createNormalizedType({ name: "Variant", transferOwnership: "none" });
            const result = mapper.mapType(type, true);

            expect(result.ffi.type).toBe("fundamental");
            expect(result.ffi.refFn).toBe("g_variant_ref_sink");
            expect(result.ffi.unrefFn).toBe("g_variant_unref");
            expect(result.ffi.ownership).toBe("borrowed");
        });
    });

    describe("mapType - inheritance for return type ownership", () => {
        it("inherits parent transfer ownership for array elements", () => {
            const buttonClass = createNormalizedClass({ name: "Button" });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                classes: new Map([["Button", buttonClass]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const type = createNormalizedType({
                name: "Button",
                isArray: true,
                elementType: createNormalizedType({ name: "Button" }),
            });
            const result = mapper.mapType(type, false, "full");

            expect(result.ffi.ownership).toBe("full");
        });

        it("inherits parent transfer for nested containers", () => {
            const { mapper } = createTestSetup();
            const innerType = createNormalizedType({ name: "utf8" });
            const type = createNormalizedType({
                name: "utf8",
                isArray: true,
                elementType: innerType,
            });

            const result = mapper.mapType(type, true, "none");

            expect(result.ffi.ownership).toBe("borrowed");
        });
    });

    describe("callback parameter mapping", () => {
        it("filters out user_data parameter from callback signature", () => {
            const asyncCallback = createNormalizedCallback({
                name: "AsyncReadyCallback",
                qualifiedName: qualifiedName("Gio", "AsyncReadyCallback"),
                parameters: [
                    createNormalizedParameter({
                        name: "source_object",
                        type: createNormalizedType({ name: "gpointer" }),
                    }),
                    createNormalizedParameter({
                        name: "res",
                        type: createNormalizedType({ name: "gpointer" }),
                    }),
                    createNormalizedParameter({
                        name: "user_data",
                        type: createNormalizedType({ name: "gpointer" }),
                    }),
                ],
                returnType: createNormalizedType({ name: "none" }),
            });
            const gioNs = createNormalizedNamespace({
                name: "Gio",
                callbacks: new Map([["AsyncReadyCallback", asyncCallback]]),
            });
            const { mapper } = createTestSetup(new Map([["Gio", gioNs]]));

            const result = mapper.getCallbackParamMappings(
                createNormalizedParameter({
                    name: "callback",
                    type: createNormalizedType({ name: "Gio.AsyncReadyCallback" }),
                }),
            );

            expect(result).not.toBeNull();
            expect(result?.length).toBe(2);
            expect(result?.find((p) => p.name === "user_data")).toBeUndefined();
        });

        it("filters out data parameter from callback signature", () => {
            const tickCallback = createNormalizedCallback({
                name: "TickCallback",
                qualifiedName: qualifiedName("Gtk", "TickCallback"),
                parameters: [
                    createNormalizedParameter({
                        name: "widget",
                        type: createNormalizedType({ name: "gpointer" }),
                    }),
                    createNormalizedParameter({
                        name: "frame_clock",
                        type: createNormalizedType({ name: "gpointer" }),
                    }),
                    createNormalizedParameter({
                        name: "data",
                        type: createNormalizedType({ name: "gpointer" }),
                    }),
                ],
                returnType: createNormalizedType({ name: "gboolean" }),
            });
            const gtkNs = createNormalizedNamespace({
                name: "Gtk",
                callbacks: new Map([["TickCallback", tickCallback]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", gtkNs]]));

            const result = mapper.getCallbackParamMappings(
                createNormalizedParameter({
                    name: "callback",
                    type: createNormalizedType({ name: "Gtk.TickCallback" }),
                }),
            );

            expect(result).not.toBeNull();
            expect(result?.length).toBe(2);
            expect(result?.find((p) => p.name === "data")).toBeUndefined();
        });

        it("returns mappings for any GIR callback (all are now supported)", () => {
            const customCallback = createNormalizedCallback({
                name: "CustomCallback",
                qualifiedName: qualifiedName("Gtk", "CustomCallback"),
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                callbacks: new Map([["CustomCallback", customCallback]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const result = mapper.getCallbackParamMappings(
                createNormalizedParameter({
                    name: "callback",
                    type: createNormalizedType({ name: "CustomCallback" }),
                }),
            );

            expect(result).not.toBeNull();
        });

        it("maps callback return type correctly", () => {
            const tickCallback = createNormalizedCallback({
                name: "TickCallback",
                qualifiedName: qualifiedName("Gtk", "TickCallback"),
                parameters: [],
                returnType: createNormalizedType({ name: "gboolean" }),
            });
            const gtkNs = createNormalizedNamespace({
                name: "Gtk",
                callbacks: new Map([["TickCallback", tickCallback]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", gtkNs]]));

            const result = mapper.getCallbackReturnType(
                createNormalizedParameter({
                    name: "callback",
                    type: createNormalizedType({ name: "Gtk.TickCallback" }),
                }),
            );

            expect(result).not.toBeNull();
            expect(result?.ts).toBe("boolean");
        });
    });

    describe("isClosureTarget - destroy notify parameter", () => {
        it("returns true for destroy notify parameter of supported callback", () => {
            const asyncCallback = createNormalizedCallback({
                name: "AsyncReadyCallback",
                qualifiedName: qualifiedName("Gio", "AsyncReadyCallback"),
            });
            const gioNs = createNormalizedNamespace({
                name: "Gio",
                callbacks: new Map([["AsyncReadyCallback", asyncCallback]]),
            });
            const gtkNs = createNormalizedNamespace({ name: "Gtk" });
            const { mapper } = createTestSetup(
                new Map([
                    ["Gio", gioNs],
                    ["Gtk", gtkNs],
                ]),
            );

            const callbackParam = createNormalizedParameter({
                name: "callback",
                type: createNormalizedType({ name: "Gio.AsyncReadyCallback" }),
                closure: 1,
                destroy: 2,
            });
            const userDataParam = createNormalizedParameter({
                name: "user_data",
                type: createNormalizedType({ name: "gpointer" }),
            });
            const destroyParam = createNormalizedParameter({
                name: "destroy_notify",
                type: createNormalizedType({ name: "GLib.DestroyNotify" }),
            });
            const allParams = [callbackParam, userDataParam, destroyParam];

            expect(mapper.isClosureTarget(destroyParam, allParams)).toBe(true);
            expect(mapper.isClosureTarget(userDataParam, allParams)).toBe(true);
            expect(mapper.isClosureTarget(callbackParam, allParams)).toBe(false);
        });
    });

    describe("mapType - enum with GType metadata", () => {
        it("includes library and getTypeFn for enum with glibGetType", () => {
            const enumType = createNormalizedEnumeration({
                name: "Orientation",
                glibGetType: "gtk_orientation_get_type",
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                sharedLibrary: "libgtk-4.so.1",
                enumerations: new Map([["Orientation", enumType]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const type = createNormalizedType({ name: "Orientation" });
            const result = mapper.mapType(type);

            expect(result.ffi.library).toBe("libgtk-4.so.1");
            expect(result.ffi.getTypeFn).toBe("gtk_orientation_get_type");
        });

        it("includes library and getTypeFn for flags with glibGetType", () => {
            const flags = createNormalizedEnumeration({
                name: "StateFlags",
                glibGetType: "gtk_state_flags_get_type",
            });
            const ns = createNormalizedNamespace({
                name: "Gtk",
                sharedLibrary: "libgtk-4.so.1",
                bitfields: new Map([["StateFlags", flags]]),
            });
            const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

            const type = createNormalizedType({ name: "StateFlags" });
            const result = mapper.mapType(type);

            expect(result.ffi.library).toBe("libgtk-4.so.1");
            expect(result.ffi.getTypeFn).toBe("gtk_state_flags_get_type");
            expect(result.ffi.unsigned).toBe(true);
        });
    });
});
