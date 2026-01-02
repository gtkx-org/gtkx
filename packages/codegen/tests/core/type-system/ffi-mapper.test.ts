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

                expect(result.ffi).toEqual({ type: "string", ownership: "none" });
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
                    expect(result.ffi.listType).toBe("glist");
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
                    expect(result.ffi.listType).toBe("gslist");
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

            it("maps GLib.Variant specially", () => {
                const variant = createNormalizedRecord({
                    name: "Variant",
                    qualifiedName: qualifiedName("GLib", "Variant"),
                    glibTypeName: "GVariant",
                    glibGetType: "g_variant_get_type",
                });
                const glibNs = createNormalizedNamespace({
                    name: "GLib",
                    records: new Map([["Variant", variant]]),
                });
                const repo = createMockRepository(new Map([["GLib", glibNs]]));
                const mapper = new FfiMapper(repo as Parameters<typeof FfiMapper>[0], "GLib");

                const type = createNormalizedType({ name: "Variant" });
                const result = mapper.mapType(type);

                expect(result.ts).toBe("Variant");
                expect(result.ffi.type).toBe("gvariant");
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
            it("maps ParamSpec specially", () => {
                const paramSpec = createNormalizedClass({
                    name: "ParamSpec",
                    qualifiedName: qualifiedName("GObject", "ParamSpec"),
                    glibTypeName: "GParam",
                });
                const gobjectNs = createNormalizedNamespace({
                    name: "GObject",
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

                expect(result.ffi.type).toBe("gparam");
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

            it("sets ownership to none for transfer-none", () => {
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
                    expect(result.ffi.ownership).toBe("none");
                }
            });
        });

        describe("callbacks in parameters", () => {
            it("maps supported callback with trampoline", () => {
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

                expect(result.ffi.type).toBe("callback");
                if (result.ffi.type === "callback") {
                    expect(result.ffi.trampoline).toBe("asyncReady");
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

        it("returns true for unsupported callback", () => {
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
            expect(mapper.hasUnsupportedCallback(param)).toBe(true);
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
