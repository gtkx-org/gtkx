import { describe, expect, it } from "vitest";
import { GirAlias } from "../../src/gir/index.js";
import { FfiMapper } from "../../src/type-system/ffi-mapper.js";
import { FFI_INT32, FFI_POINTER, FFI_UINT32, FFI_VOID } from "../../src/type-system/ffi-types.js";
import {
    createNormalizedCallback,
    createNormalizedClass,
    createNormalizedEnumeration,
    createNormalizedField,
    createNormalizedFunction,
    createNormalizedInterface,
    createNormalizedNamespace,
    createNormalizedParameter,
    createNormalizedRecord,
    createNormalizedType,
    qualifiedName,
} from "../fixtures/gir-fixtures.js";
import { createMockRepository, type MockGirRepository } from "../fixtures/mock-repository.js";

function createTestSetup(namespaces: Map<string, ReturnType<typeof createNormalizedNamespace>> = new Map()): {
    repo: MockGirRepository;
    mapper: FfiMapper;
} {
    const repo = createMockRepository(namespaces);
    const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "Gtk");
    return { repo, mapper };
}

describe("FfiMapper / mapType / primitives (1)", () => {
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

    it("maps gint64 to number with int64", () => {
        const { mapper } = createTestSetup();
        const type = createNormalizedType({ name: "gint64" });
        const result = mapper.mapType(type);

        expect(result.ts).toBe("number");
        expect(result.ffi).toEqual({ type: "int64" });
    });

    it("maps guint64 to number with uint64", () => {
        const { mapper } = createTestSetup();
        const type = createNormalizedType({ name: "guint64" });
        const result = mapper.mapType(type);

        expect(result.ts).toBe("number");
        expect(result.ffi).toEqual({ type: "uint64" });
    });

    it("maps guint8 to number with uint8", () => {
        const { mapper } = createTestSetup();
        const type = createNormalizedType({ name: "guint8" });
        const result = mapper.mapType(type);

        expect(result.ts).toBe("number");
        expect(result.ffi).toEqual({ type: "uint8" });
    });
});

describe("FfiMapper / mapType / primitives (2)", () => {
    it("maps gfloat to number with float32", () => {
        const { mapper } = createTestSetup();
        const type = createNormalizedType({ name: "gfloat" });
        const result = mapper.mapType(type);

        expect(result.ts).toBe("number");
        expect(result.ffi).toEqual({ type: "float32" });
    });

    it("maps gdouble to number with float64", () => {
        const { mapper } = createTestSetup();
        const type = createNormalizedType({ name: "gdouble" });
        const result = mapper.mapType(type);

        expect(result.ts).toBe("number");
        expect(result.ffi).toEqual({ type: "float64" });
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

describe("FfiMapper / mapType / strings", () => {
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

describe("FfiMapper / mapType / arrays (1)", () => {
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
});

describe("FfiMapper / mapType / arrays (2)", () => {
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
});

describe("FfiMapper / mapType / arrays (3)", () => {
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
});

describe("FfiMapper / mapType / arrays (4)", () => {
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

describe("FfiMapper / mapType / classes (1)", () => {
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
});

describe("FfiMapper / mapType / classes (2)", () => {
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
});

describe("FfiMapper / mapType / classes (3)", () => {
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

describe("FfiMapper / mapType / interfaces", () => {
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

describe("FfiMapper / mapType / records (1)", () => {
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
        const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "Gdk");

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
            fields: [
                createNormalizedField({ name: "red", type: createNormalizedType({ name: "guint16" }) }),
                createNormalizedField({ name: "green", type: createNormalizedType({ name: "guint16" }) }),
                createNormalizedField({ name: "blue", type: createNormalizedType({ name: "guint16" }) }),
            ],
        });
        const ns = createNormalizedNamespace({
            name: "Gdk",
            records: new Map([["Color", record]]),
        });
        const repo = createMockRepository(new Map([["Gdk", ns]]));
        const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "Gdk");

        const type = createNormalizedType({ name: "Color" });
        const result = mapper.mapType(type);

        expect(result.ts).toBe("Color");
        expect(result.ffi.type).toBe("struct");
    });
});

describe("FfiMapper / mapType / records (2)", () => {
    it("maps plain struct record with no fields as unsafe", () => {
        const record = createNormalizedRecord({
            name: "Color",
            qualifiedName: qualifiedName("Gdk", "Color"),
        });
        const ns = createNormalizedNamespace({
            name: "Gdk",
            records: new Map([["Color", record]]),
        });
        const repo = createMockRepository(new Map([["Gdk", ns]]));
        const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "Gdk");

        const type = createNormalizedType({ name: "Color" });
        const result = mapper.mapType(type);

        expect(result.unsafe).toBe(true);
        expect(result.ts).toBe("unknown");
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
        const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "GLib");

        const type = createNormalizedType({ name: "Variant" });
        const result = mapper.mapType(type);

        expect(result.ts).toBe("Variant");
        expect(result.ffi.type).toBe("fundamental");
    });
});

describe("FfiMapper / mapType / enums and flags", () => {
    it("maps enum to FFI_UINT32", () => {
        const enumType = createNormalizedEnumeration({ name: "Orientation" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            enumerations: new Map([["Orientation", enumType]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const type = createNormalizedType({ name: "Orientation" });
        const result = mapper.mapType(type);

        expect(result.ts).toBe("Orientation");
        expect(result.ffi).toEqual(FFI_UINT32);
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

describe("FfiMapper / mapType / callbacks", () => {
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

describe("FfiMapper / mapType / GObject.ParamSpec", () => {
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

describe("FfiMapper / mapType / unknown types", () => {
    it("maps unknown type to number/pointer", () => {
        const { mapper } = createTestSetup();
        const type = createNormalizedType({ name: "SomeUnknownType" });
        const result = mapper.mapType(type);

        expect(result.ts).toBe("number");
        expect(result.ffi).toEqual(FFI_POINTER);
    });
});

describe("FfiMapper / mapParameter / out parameters (1)", () => {
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
});

describe("FfiMapper / mapParameter / out parameters (2)", () => {
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
        const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "Gdk");

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

describe("FfiMapper / mapParameter / ownership transfer (1)", () => {
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

describe("FfiMapper / mapParameter / ownership transfer (2)", () => {
    it("sets ownership to full for transfer-container on GObject parameter", () => {
        const buttonClass = createNormalizedClass({ name: "Button" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            classes: new Map([["Button", buttonClass]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const param = createNormalizedParameter({
            name: "widget",
            type: createNormalizedType({ name: "Button" }),
            transferOwnership: "container",
        });
        const result = mapper.mapParameter(param);

        expect(result.ffi.type).toBe("gobject");
        if (result.ffi.type === "gobject") {
            expect(result.ffi.ownership).toBe("full");
        }
    });
});

describe("FfiMapper / mapParameter / callbacks in parameters (1)", () => {
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
});

describe("FfiMapper / mapParameter / callbacks in parameters (2)", () => {
    it("maps GLib.Closure to generic callback", () => {
        const { mapper } = createTestSetup();
        const param = createNormalizedParameter({
            name: "callback",
            type: createNormalizedType({ name: "GLib.Closure" }),
        });
        const result = mapper.mapParameter(param);

        expect(result.ts).toBe("(...args: unknown[]) => unknown");
        expect(result.ffi.type).toBe("callback");
        expect(result.ffi.kind).toBe("closure");
        expect(result.ffi.argTypes).toEqual([]);
        expect(result.ffi.returnType).toEqual({ type: "void" });
    });
});

describe("FfiMapper / isCallback", () => {
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

describe("FfiMapper / isClosureTarget", () => {
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

describe("FfiMapper / isNullable", () => {
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

describe("FfiMapper / hasUnsupportedCallback (1)", () => {
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

    it("returns false for a GIR callback whose params/return are all safe", () => {
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
});

describe("FfiMapper / hasUnsupportedCallback (2)", () => {
    it("returns true for GLib.Closure (untyped variadic, unsafe)", () => {
        const { mapper } = createTestSetup();
        const param = createNormalizedParameter({
            name: "closure",
            type: createNormalizedType({ name: "GLib.Closure" }),
        });
        expect(mapper.hasUnsupportedCallback(param)).toBe(true);
    });

    it("returns true for raw pointer parameter (gpointer)", () => {
        const { mapper } = createTestSetup();
        const param = createNormalizedParameter({
            name: "data",
            type: createNormalizedType({ name: "gpointer" }),
        });
        expect(mapper.hasUnsupportedCallback(param)).toBe(true);
    });

    it("returns false for primitive uint64 (gsize) — not a pointer", () => {
        const { mapper } = createTestSetup();
        const param = createNormalizedParameter({
            name: "size",
            type: createNormalizedType({ name: "gsize" }),
        });
        expect(mapper.hasUnsupportedCallback(param)).toBe(false);
    });
});

describe("FfiMapper - Extended Coverage / mapParameter - out/inout for all type kinds (1)", () => {
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
});

describe("FfiMapper - Extended Coverage / mapParameter - out/inout for all type kinds (2)", () => {
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
});

describe("FfiMapper - Extended Coverage / mapParameter - out/inout for all type kinds (3)", () => {
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
});

describe("FfiMapper - Extended Coverage / mapParameter - out/inout for all type kinds (4)", () => {
    it("handles out struct without Ref when caller-allocates", () => {
        const record = createNormalizedRecord({
            name: "Color",
            qualifiedName: qualifiedName("Gdk", "Color"),
            fields: [
                createNormalizedField({ name: "red", type: createNormalizedType({ name: "guint16" }) }),
                createNormalizedField({ name: "green", type: createNormalizedType({ name: "guint16" }) }),
                createNormalizedField({ name: "blue", type: createNormalizedType({ name: "guint16" }) }),
            ],
        });
        const ns = createNormalizedNamespace({
            name: "Gdk",
            records: new Map([["Color", record]]),
        });
        const repo = createMockRepository(new Map([["Gdk", ns]]));
        const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "Gdk");

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
});

describe("FfiMapper - Extended Coverage / mapParameter - out/inout for all type kinds (5)", () => {
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
            expect(result.ffi.innerType).toEqual({ type: "float32" });
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

describe("FfiMapper - Extended Coverage / mapType - transfer ownership comprehensive (1)", () => {
    it("maps string with transfer-container as full ownership", () => {
        const { mapper } = createTestSetup();
        const type = createNormalizedType({ name: "utf8", transferOwnership: "container" });
        const result = mapper.mapType(type);

        expect(result.ffi).toEqual({ type: "string", ownership: "full" });
    });

    it("maps GObject array with container transfer - container owned, elements borrowed", () => {
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
        expect(result.ffi.itemType?.type).toBe("gobject");
        expect(result.ffi.itemType?.ownership).toBe("borrowed");
    });
});

describe("FfiMapper - Extended Coverage / mapType - transfer ownership comprehensive (2)", () => {
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
        const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "Gdk");

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
        const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "Gdk");

        const type = createNormalizedType({ name: "Rectangle", transferOwnership: "none" });
        const result = mapper.mapType(type, true);

        expect(result.ffi.type).toBe("boxed");
        expect(result.ffi.ownership).toBe("borrowed");
    });
});

describe("FfiMapper - Extended Coverage / mapType - transfer ownership comprehensive (3)", () => {
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
});

describe("FfiMapper - Extended Coverage / mapType - transfer ownership comprehensive (4)", () => {
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

    it("maps GObject array with full transfer - elements are fully owned", () => {
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
            transferOwnership: "full",
        });
        const result = mapper.mapType(type);

        expect(result.ffi.type).toBe("array");
        expect(result.ffi.ownership).toBe("full");
        expect(result.ffi.itemType?.type).toBe("gobject");
        expect(result.ffi.itemType?.ownership).toBe("full");
    });
});

describe("FfiMapper - Extended Coverage / mapType - transfer ownership comprehensive (5)", () => {
    it("maps string array with container transfer - elements are borrowed", () => {
        const { mapper } = createTestSetup();

        const type = createNormalizedType({
            name: "utf8",
            isArray: true,
            elementType: createNormalizedType({ name: "utf8" }),
            transferOwnership: "container",
        });
        const result = mapper.mapType(type);

        expect(result.ffi.type).toBe("array");
        expect(result.ffi.ownership).toBe("full");
        expect(result.ffi.itemType?.type).toBe("string");
        expect(result.ffi.itemType?.ownership).toBe("borrowed");
    });

    it("maps hashtable with container transfer - keys and values are borrowed", () => {
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
            transferOwnership: "container",
        });
        const result = mapper.mapType(type);

        expect(result.ffi.type).toBe("hashtable");
        expect(result.ffi.ownership).toBe("full");
        expect(result.ffi.keyType?.type).toBe("string");
        expect(result.ffi.keyType?.ownership).toBe("borrowed");
        expect(result.ffi.valueType?.type).toBe("gobject");
        expect(result.ffi.valueType?.ownership).toBe("borrowed");
    });
});

describe("FfiMapper - Extended Coverage / mapType - transfer ownership comprehensive (6)", () => {
    it("maps hashtable with full transfer - keys and values are fully owned", () => {
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
            transferOwnership: "full",
        });
        const result = mapper.mapType(type);

        expect(result.ffi.type).toBe("hashtable");
        expect(result.ffi.ownership).toBe("full");
        expect(result.ffi.keyType?.type).toBe("string");
        expect(result.ffi.keyType?.ownership).toBe("full");
        expect(result.ffi.valueType?.type).toBe("gobject");
        expect(result.ffi.valueType?.ownership).toBe("full");
    });
});

describe("FfiMapper - Extended Coverage / mapType - array edge cases (1)", () => {
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
});

describe("FfiMapper - Extended Coverage / mapType - array edge cases (2)", () => {
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
});

describe("FfiMapper - Extended Coverage / mapType - array edge cases (3)", () => {
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
            expect(result.ffi.itemType.type).toBe("float64");
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
});

describe("FfiMapper - Extended Coverage / mapType - array edge cases (4)", () => {
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

describe("FfiMapper - Extended Coverage / mapType - hashtable edge cases (1)", () => {
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
            expect(result.ffi.keyType.type).toBe("int32");
        }
    });
});

describe("FfiMapper - Extended Coverage / mapType - hashtable edge cases (2)", () => {
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
});

describe("FfiMapper - Extended Coverage / mapType - hashtable edge cases (3)", () => {
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
            expect(result.ffi.valueType.type).toBe("float64");
        }
    });
});

describe("FfiMapper - Extended Coverage / mapType - hashtable edge cases (4)", () => {
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
            expect(result.ffi.keyType.type).toBe("float32");
        }
    });
});

describe("FfiMapper - Extended Coverage / mapType - fundamental types (1)", () => {
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
});

describe("FfiMapper - Extended Coverage / mapType - fundamental types (2)", () => {
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
        const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "GLib");

        const type = createNormalizedType({ name: "Variant", transferOwnership: "none" });
        const result = mapper.mapType(type, true);

        expect(result.ffi.type).toBe("fundamental");
        expect(result.ffi.refFn).toBe("g_variant_ref_sink");
        expect(result.ffi.unrefFn).toBe("g_variant_unref");
        expect(result.ffi.ownership).toBe("borrowed");
    });
});

describe("FfiMapper - Extended Coverage / mapType - inheritance for return type ownership", () => {
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

describe("FfiMapper - Extended Coverage / callback parameter mapping (1)", () => {
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
});

describe("FfiMapper - Extended Coverage / callback parameter mapping (2)", () => {
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
});

describe("FfiMapper - Extended Coverage / callback parameter mapping (3)", () => {
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

describe("FfiMapper - Extended Coverage / isClosureTarget - destroy notify parameter", () => {
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

describe("FfiMapper - Extended Coverage / mapType - enum with GType metadata", () => {
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
    });
});

describe("FfiMapper - branch coverage / getCurrentNamespace", () => {
    it("returns the namespace passed to the constructor", () => {
        const { mapper } = createTestSetup();
        expect(mapper.getCurrentNamespace()).toBe("Gtk");
    });
});

describe("FfiMapper - branch coverage / mapType - GType", () => {
    it("maps GType to a qualified GObject.GType for external namespaces", () => {
        const { mapper } = createTestSetup();
        const type = createNormalizedType({ name: "GType" });
        const result = mapper.mapType(type);

        expect(result.ts).toBe("GObject.GType");
        expect(result.imports[0]).toMatchObject({ kind: "alias", name: "GType", isExternal: true });
    });

    it("maps GType to a bare GType inside the GObject namespace", () => {
        const ns = createNormalizedNamespace({ name: "GObject" });
        const repo = createMockRepository(new Map([["GObject", ns]]));
        const mapper = new FfiMapper(repo as ConstructorParameters<typeof FfiMapper>[0], "GObject");

        const result = mapper.mapType(createNormalizedType({ name: "GType" }));

        expect(result.ts).toBe("GType");
        expect(result.imports[0]).toMatchObject({ isExternal: false });
    });
});

describe("FfiMapper - branch coverage / mapType - GByteArray and GLib array fallbacks", () => {
    it("maps a GByteArray to number[]", () => {
        const { mapper } = createTestSetup();
        const type = createNormalizedType({
            name: qualifiedName("GLib", "ByteArray"),
            isArray: true,
            containerType: "gbytearray",
            elementType: createNormalizedType({ name: "guint8" }),
        });
        const result = mapper.mapType(type);

        expect(result.ts).toBe("number[]");
        expect(result.ffi.type).toBe("array");
        if (result.ffi.type === "array") {
            expect(result.ffi.kind).toBe("gbytearray");
        }
    });

    it("maps a GPtrArray without an element type to unknown[]", () => {
        const { mapper } = createTestSetup();
        const type = createNormalizedType({
            name: qualifiedName("GLib", "PtrArray"),
            isArray: true,
            containerType: "gptrarray",
            elementType: null,
        });
        const result = mapper.mapType(type);

        expect(result.ts).toBe("unknown[]");
        expect(result.unsafe).toBe(true);
        expect(result.ffi.type).toBe("array");
    });

    it("maps a GArray without an element type to unknown[]", () => {
        const { mapper } = createTestSetup();
        const type = createNormalizedType({
            name: qualifiedName("GLib", "Array"),
            isArray: true,
            containerType: "garray",
            elementType: null,
        });
        const result = mapper.mapType(type);

        expect(result.ts).toBe("unknown[]");
        expect(result.unsafe).toBe(true);
    });
});

describe("FfiMapper - branch coverage / mapType - unmarshalable record", () => {
    it("maps an opaque record as an unsafe struct", () => {
        const opaque = createNormalizedRecord({
            name: "Private",
            qualifiedName: qualifiedName("Gtk", "Private"),
            opaque: true,
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([["Private", opaque]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const result = mapper.mapType(createNormalizedType({ name: "Private" }));

        expect(result.ts).toBe("unknown");
        expect(result.ffi.type).toBe("struct");
        expect(result.unsafe).toBe(true);
    });
});

describe("FfiMapper - branch coverage / mapType - alias resolution (1)", () => {
    it("resolves an alias to a same-namespace target type", () => {
        const buttonClass = createNormalizedClass({ name: "Button" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            classes: new Map([["Button", buttonClass]]),
            aliases: new Map([
                [
                    "ButtonAlias",
                    new GirAlias({
                        name: "ButtonAlias",
                        qualifiedName: qualifiedName("Gtk", "ButtonAlias"),
                        cType: "GtkButtonAlias",
                        targetType: createNormalizedType({ name: "Button" }),
                    }),
                ],
            ]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const result = mapper.mapType(createNormalizedType({ name: "ButtonAlias" }));

        expect(result.ts).toBe("Button");
        expect(result.ffi.type).toBe("gobject");
    });
});

describe("FfiMapper - branch coverage / mapType - alias resolution (2)", () => {
    it("resolves an alias to a qualified target type", () => {
        const appClass = createNormalizedClass({
            name: "Application",
            qualifiedName: qualifiedName("Gio", "Application"),
        });
        const gioNs = createNormalizedNamespace({
            name: "Gio",
            classes: new Map([["Application", appClass]]),
        });
        const gtkNs = createNormalizedNamespace({
            name: "Gtk",
            aliases: new Map([
                [
                    "AppAlias",
                    new GirAlias({
                        name: "AppAlias",
                        qualifiedName: qualifiedName("Gtk", "AppAlias"),
                        cType: "GtkAppAlias",
                        targetType: createNormalizedType({ name: "Gio.Application" }),
                    }),
                ],
            ]),
        });
        const { mapper } = createTestSetup(
            new Map([
                ["Gio", gioNs],
                ["Gtk", gtkNs],
            ]),
        );

        const result = mapper.mapType(createNormalizedType({ name: "AppAlias" }));

        expect(result.ts).toBe("Gio.Application");
    });
});

describe("FfiMapper - branch coverage / mapType - external namespace fallthrough", () => {
    it("resolves a bare type name found only in an external namespace", () => {
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
                ["Gtk", gtkNs],
                ["Gio", gioNs],
            ]),
        );

        const result = mapper.mapType(createNormalizedType({ name: "Application" }));

        expect(result.ts).toBe("Gio.Application");
        expect(result.imports[0]).toMatchObject({ namespace: "Gio", isExternal: true });
    });
});

describe("FfiMapper - branch coverage / enrichStructWithSize (1)", () => {
    it("adds a computed size to a struct descriptor", () => {
        const colorRecord = createNormalizedRecord({
            name: "Color",
            qualifiedName: qualifiedName("Gtk", "Color"),
            fields: [
                createNormalizedField({ name: "red", type: createNormalizedType({ name: "guint16" }) }),
                createNormalizedField({ name: "green", type: createNormalizedType({ name: "guint16" }) }),
                createNormalizedField({ name: "blue", type: createNormalizedType({ name: "guint16" }) }),
            ],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([["Color", colorRecord]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const enriched = mapper.enrichStructWithSize(
            { type: "struct", innerType: "Color", ownership: "borrowed" },
            "Color",
        );

        expect(enriched.type).toBe("struct");
        if (enriched.type === "struct") {
            expect(enriched.size).toBeGreaterThan(0);
        }
    });
});

describe("FfiMapper - branch coverage / enrichStructWithSize (2)", () => {
    it("resolves a qualified type name when enriching a struct", () => {
        const colorRecord = createNormalizedRecord({
            name: "Color",
            qualifiedName: qualifiedName("Gdk", "Color"),
            fields: [createNormalizedField({ name: "red", type: createNormalizedType({ name: "guint32" }) })],
        });
        const gdkNs = createNormalizedNamespace({
            name: "Gdk",
            records: new Map([["Color", colorRecord]]),
        });
        const gtkNs = createNormalizedNamespace({ name: "Gtk" });
        const { mapper } = createTestSetup(
            new Map([
                ["Gtk", gtkNs],
                ["Gdk", gdkNs],
            ]),
        );

        const enriched = mapper.enrichStructWithSize(
            { type: "struct", innerType: "Color", ownership: "borrowed" },
            "Gdk.Color",
        );

        if (enriched.type === "struct") {
            expect(enriched.size).toBe(4);
        }
    });

    it("returns the descriptor unchanged when it is not a struct", () => {
        const { mapper } = createTestSetup();
        const descriptor = mapper.enrichStructWithSize(FFI_INT32, "Color");
        expect(descriptor).toEqual(FFI_INT32);
    });

    it("returns the descriptor unchanged when the size is already set", () => {
        const { mapper } = createTestSetup();
        const input = { type: "struct" as const, innerType: "Color", ownership: "borrowed" as const, size: 8 };
        expect(mapper.enrichStructWithSize(input, "Color")).toBe(input);
    });
});

describe("FfiMapper - branch coverage / canAllocateLocally (1)", () => {
    it("returns true for a plain struct record with public fields", () => {
        const record = createNormalizedRecord({
            name: "Color",
            qualifiedName: qualifiedName("Gtk", "Color"),
            fields: [createNormalizedField({ name: "red", type: createNormalizedType({ name: "guint16" }) })],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([["Color", record]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        expect(mapper.canAllocateLocally("Color")).toBe(true);
    });

    it("returns false for an opaque record", () => {
        const record = createNormalizedRecord({
            name: "Opaque",
            qualifiedName: qualifiedName("Gtk", "Opaque"),
            opaque: true,
            fields: [createNormalizedField({ name: "x", type: createNormalizedType({ name: "gint" }) })],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([["Opaque", record]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        expect(mapper.canAllocateLocally("Opaque")).toBe(false);
    });

    it("returns false when the namespace does not exist", () => {
        const { mapper } = createTestSetup();
        expect(mapper.canAllocateLocally("Missing.Type")).toBe(false);
    });

    it("returns false for an unknown type name", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        expect(mapper.canAllocateLocally("DoesNotExist")).toBe(false);
    });
});

describe("FfiMapper - branch coverage / canAllocateLocally (2)", () => {
    it("follows an alias to its allocatable target", () => {
        const record = createNormalizedRecord({
            name: "Color",
            qualifiedName: qualifiedName("Gtk", "Color"),
            fields: [createNormalizedField({ name: "red", type: createNormalizedType({ name: "guint16" }) })],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([["Color", record]]),
            aliases: new Map([
                [
                    "ColorAlias",
                    new GirAlias({
                        name: "ColorAlias",
                        qualifiedName: qualifiedName("Gtk", "ColorAlias"),
                        cType: "GtkColorAlias",
                        targetType: createNormalizedType({ name: "Color" }),
                    }),
                ],
            ]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        expect(mapper.canAllocateLocally("ColorAlias")).toBe(true);
    });
});

describe("FfiMapper - branch coverage / findFactoryCIdentifier (1)", () => {
    it("finds a zero-argument factory function for a record", () => {
        const factory = createNormalizedFunction({
            name: "map_create",
            cIdentifier: "hb_map_create",
            returnType: createNormalizedType({ name: "map_t" }),
            parameters: [],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            functions: new Map([["map_create", factory]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        expect(mapper.findFactoryCIdentifier("map_t")).toBe("mapCreate");
    });

    it("returns null when the factory has parameters", () => {
        const factory = createNormalizedFunction({
            name: "thing_create",
            cIdentifier: "thing_create",
            returnType: createNormalizedType({ name: "thing" }),
            parameters: [createNormalizedParameter({ name: "arg" })],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            functions: new Map([["thing_create", factory]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        expect(mapper.findFactoryCIdentifier("thing")).toBeNull();
    });

    it("returns null when no factory function exists", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        expect(mapper.findFactoryCIdentifier("Missing")).toBeNull();
    });

    it("returns null for a type in a different namespace", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        expect(mapper.findFactoryCIdentifier("Gio.Thing")).toBeNull();
    });
});

describe("FfiMapper - branch coverage / findFactoryCIdentifier (2)", () => {
    it("returns null when the factory return type does not match", () => {
        const factory = createNormalizedFunction({
            name: "thing_create",
            cIdentifier: "thing_create",
            returnType: createNormalizedType({ name: "other" }),
            parameters: [],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            functions: new Map([["thing_create", factory]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        expect(mapper.findFactoryCIdentifier("thing")).toBeNull();
    });
});

describe("FfiMapper - branch coverage / mapParameter - callback with destroy and scope", () => {
    it("marks a trampoline as having a destroy notify and a scope", () => {
        const callback = createNormalizedCallback({
            name: "Callback",
            qualifiedName: qualifiedName("Gtk", "Callback"),
            parameters: [createNormalizedParameter({ name: "data", type: createNormalizedType({ name: "gpointer" }) })],
            returnType: createNormalizedType({ name: "none" }),
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            callbacks: new Map([["Callback", callback]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const param = createNormalizedParameter({
            name: "callback",
            type: createNormalizedType({ name: "Callback" }),
            destroy: 2,
            scope: "notified",
        });
        const result = mapper.mapParameter(param);

        expect(result.ffi.type).toBe("trampoline");
        if (result.ffi.type === "trampoline") {
            expect(result.ffi.hasDestroy).toBe(true);
            expect(result.ffi.scope).toBe("notified");
        }
    });
});

describe("FfiMapper - branch coverage / mapCallback - parameters and return (1)", () => {
    it("builds a callback TS signature with named parameters and a return", () => {
        const callback = createNormalizedCallback({
            name: "Predicate",
            qualifiedName: qualifiedName("Gtk", "Predicate"),
            parameters: [
                createNormalizedParameter({ name: "item_value", type: createNormalizedType({ name: "gint" }) }),
            ],
            returnType: createNormalizedType({ name: "gboolean" }),
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            callbacks: new Map([["Predicate", callback]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const param = createNormalizedParameter({
            name: "predicate",
            type: createNormalizedType({ name: "Predicate" }),
        });
        const result = mapper.mapParameter(param);

        expect(result.ts).toBe("(itemValue: number) => boolean");
    });
});

describe("FfiMapper - branch coverage / mapCallback - parameters and return (2)", () => {
    it("includes a nullable marker on a nullable callback parameter and return", () => {
        const callback = createNormalizedCallback({
            name: "Lookup",
            qualifiedName: qualifiedName("Gtk", "Lookup"),
            parameters: [
                createNormalizedParameter({
                    name: "key",
                    type: createNormalizedType({ name: "utf8" }),
                    nullable: true,
                }),
            ],
            returnType: createNormalizedType({ name: "utf8", nullable: true }),
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            callbacks: new Map([["Lookup", callback]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const param = createNormalizedParameter({
            name: "lookup",
            type: createNormalizedType({ name: "Lookup" }),
        });
        const result = mapper.mapParameter(param);

        expect(result.ts).toBe("(key: string | null) => string | null");
    });
});

describe("FfiMapper - branch coverage / getCallbackParamMappings / getCallbackReturnType - non-callback", () => {
    it("returns null for getCallbackParamMappings on a non-callback parameter", () => {
        const { mapper } = createTestSetup();
        const param = createNormalizedParameter({ name: "x", type: createNormalizedType({ name: "gint" }) });

        expect(mapper.getCallbackParamMappings(param)).toBeNull();
    });

    it("returns null for getCallbackReturnType on a non-callback parameter", () => {
        const { mapper } = createTestSetup();
        const param = createNormalizedParameter({ name: "x", type: createNormalizedType({ name: "gint" }) });

        expect(mapper.getCallbackReturnType(param)).toBeNull();
    });
});

describe("FfiMapper - branch coverage / mapType - struct element sizes (1)", () => {
    it("computes the inline element size for an array of plain structs", () => {
        const point = createNormalizedRecord({
            name: "Point",
            qualifiedName: qualifiedName("Gtk", "Point"),
            fields: [
                createNormalizedField({ name: "x", type: createNormalizedType({ name: "gint32" }) }),
                createNormalizedField({ name: "y", type: createNormalizedType({ name: "gint32" }) }),
            ],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([["Point", point]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const type = createNormalizedType({
            name: "Point",
            isArray: true,
            elementType: createNormalizedType({ name: "Point" }),
            fixedSize: 3,
        });
        const result = mapper.mapType(type);

        expect(result.ffi.type).toBe("array");
        if (result.ffi.type === "array") {
            expect(result.ffi.elementSize).toBe(8);
        }
    });

    it("skips inline element sizing for pointer element types", () => {
        const { mapper } = createTestSetup();
        const type = createNormalizedType({
            name: "utf8",
            isArray: true,
            elementType: createNormalizedType({ name: "utf8", cType: "char*" }),
            fixedSize: 2,
        });
        const result = mapper.mapType(type);

        expect(result.ffi.type).toBe("array");
        if (result.ffi.type === "array") {
            expect(result.ffi.elementSize).toBeUndefined();
        }
    });
});

describe("FfiMapper - branch coverage / mapType - struct element sizes (2)", () => {
    it("uses the known struct element size for GValue arrays", () => {
        const { mapper } = createTestSetup();
        const type = createNormalizedType({
            name: "GValue",
            isArray: true,
            elementType: createNormalizedType({ name: "GValue" }),
            fixedSize: 2,
        });
        const result = mapper.mapType(type);

        expect(result.ffi.type).toBe("array");
        if (result.ffi.type === "array") {
            expect(result.ffi.elementSize).toBe(24);
        }
    });

    it("computes the size of a union record as its largest field", () => {
        const union = createNormalizedRecord({
            name: "Variant",
            qualifiedName: qualifiedName("Gtk", "Variant"),
            isUnion: true,
            fields: [
                createNormalizedField({ name: "small", type: createNormalizedType({ name: "gint8" }) }),
                createNormalizedField({ name: "big", type: createNormalizedType({ name: "gint64" }) }),
            ],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([["Variant", union]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const type = createNormalizedType({
            name: "Variant",
            isArray: true,
            elementType: createNormalizedType({ name: "Variant" }),
            fixedSize: 2,
        });
        const result = mapper.mapType(type);

        if (result.ffi.type === "array") {
            expect(result.ffi.elementSize).toBe(8);
        }
    });
});

describe("FfiMapper - branch coverage / mapType - struct element sizes (3)", () => {
    it("computes the size of a record with an inline composite field", () => {
        const composite = createNormalizedField({
            name: "_inline",
            type: createNormalizedType({ name: "gpointer" }),
            private: true,
            inlineComposite: {
                isUnion: false,
                fields: [
                    createNormalizedField({ name: "a", type: createNormalizedType({ name: "gint32" }) }),
                    createNormalizedField({ name: "b", type: createNormalizedType({ name: "gint32" }) }),
                ],
            },
        });
        const record = createNormalizedRecord({
            name: "Outer",
            qualifiedName: qualifiedName("Gtk", "Outer"),
            fields: [
                createNormalizedField({ name: "lead", type: createNormalizedType({ name: "gint32" }) }),
                composite,
            ],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([["Outer", record]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const type = createNormalizedType({
            name: "Outer",
            isArray: true,
            elementType: createNormalizedType({ name: "Outer" }),
            fixedSize: 2,
        });
        const result = mapper.mapType(type);

        if (result.ffi.type === "array") {
            expect(result.ffi.elementSize).toBe(12);
        }
    });
});

describe("FfiMapper - branch coverage / mapType - struct element sizes (4)", () => {
    it("treats a callback-typed field as a pointer when sizing a record", () => {
        const callback = createNormalizedCallback({
            name: "Notify",
            qualifiedName: qualifiedName("Gtk", "Notify"),
        });
        const record = createNormalizedRecord({
            name: "WithCallback",
            qualifiedName: qualifiedName("Gtk", "WithCallback"),
            fields: [
                createNormalizedField({ name: "fn", type: createNormalizedType({ name: "Notify" }) }),
                createNormalizedField({ name: "count", type: createNormalizedType({ name: "gint32" }) }),
            ],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            callbacks: new Map([["Notify", callback]]),
            records: new Map([["WithCallback", record]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const type = createNormalizedType({
            name: "WithCallback",
            isArray: true,
            elementType: createNormalizedType({ name: "WithCallback" }),
            fixedSize: 2,
        });
        const result = mapper.mapType(type);

        if (result.ffi.type === "array") {
            expect(result.ffi.elementSize).toBe(16);
        }
    });
});

describe("FfiMapper - branch coverage / mapType - struct element sizes (5)", () => {
    it("sizes a record whose field is another record type", () => {
        const inner = createNormalizedRecord({
            name: "Inner",
            qualifiedName: qualifiedName("Gtk", "Inner"),
            fields: [
                createNormalizedField({ name: "a", type: createNormalizedType({ name: "gint32" }) }),
                createNormalizedField({ name: "b", type: createNormalizedType({ name: "gint32" }) }),
            ],
        });
        const outer = createNormalizedRecord({
            name: "Outer2",
            qualifiedName: qualifiedName("Gtk", "Outer2"),
            fields: [
                createNormalizedField({ name: "lead", type: createNormalizedType({ name: "gint32" }) }),
                createNormalizedField({ name: "inner", type: createNormalizedType({ name: "Inner" }) }),
            ],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([
                ["Inner", inner],
                ["Outer2", outer],
            ]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const type = createNormalizedType({
            name: "Outer2",
            isArray: true,
            elementType: createNormalizedType({ name: "Outer2" }),
            fixedSize: 2,
        });
        const result = mapper.mapType(type);

        if (result.ffi.type === "array") {
            expect(result.ffi.elementSize).toBe(12);
        }
    });
});

describe("FfiMapper - branch coverage / mapType - struct element sizes (6)", () => {
    it("sizes a record whose field references a qualified record from another namespace", () => {
        const inner = createNormalizedRecord({
            name: "Span",
            qualifiedName: qualifiedName("Gdk", "Span"),
            fields: [createNormalizedField({ name: "value", type: createNormalizedType({ name: "gint64" }) })],
        });
        const gdkNs = createNormalizedNamespace({
            name: "Gdk",
            records: new Map([["Span", inner]]),
        });
        const outer = createNormalizedRecord({
            name: "Holder",
            qualifiedName: qualifiedName("Gtk", "Holder"),
            fields: [createNormalizedField({ name: "span", type: createNormalizedType({ name: "Gdk.Span" }) })],
        });
        const gtkNs = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([["Holder", outer]]),
        });
        const { mapper } = createTestSetup(
            new Map([
                ["Gtk", gtkNs],
                ["Gdk", gdkNs],
            ]),
        );

        const type = createNormalizedType({
            name: "Holder",
            isArray: true,
            elementType: createNormalizedType({ name: "Holder" }),
            fixedSize: 2,
        });
        const result = mapper.mapType(type);

        if (result.ffi.type === "array") {
            expect(result.ffi.elementSize).toBe(8);
        }
    });
});

describe("FfiMapper - branch coverage / mapType - struct element sizes (7)", () => {
    it("falls back to a pointer size for an opaque nested record field", () => {
        const opaque = createNormalizedRecord({
            name: "OpaqueInner",
            qualifiedName: qualifiedName("Gtk", "OpaqueInner"),
            opaque: true,
        });
        const outer = createNormalizedRecord({
            name: "OpaqueHolder",
            qualifiedName: qualifiedName("Gtk", "OpaqueHolder"),
            fields: [createNormalizedField({ name: "inner", type: createNormalizedType({ name: "OpaqueInner" }) })],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([
                ["OpaqueInner", opaque],
                ["OpaqueHolder", outer],
            ]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const type = createNormalizedType({
            name: "OpaqueHolder",
            isArray: true,
            elementType: createNormalizedType({ name: "OpaqueHolder" }),
            fixedSize: 2,
        });
        const result = mapper.mapType(type);

        if (result.ffi.type === "array") {
            expect(result.ffi.elementSize).toBe(8);
        }
    });
});

describe("FfiMapper - branch coverage / mapType - struct element sizes (8)", () => {
    it("sizes a record with a fixed-size primitive array field", () => {
        const record = createNormalizedRecord({
            name: "Buffer",
            qualifiedName: qualifiedName("Gtk", "Buffer"),
            fields: [
                createNormalizedField({
                    name: "bytes",
                    type: createNormalizedType({
                        name: "guint8",
                        isArray: true,
                        elementType: createNormalizedType({ name: "guint8" }),
                        fixedSize: 4,
                    }),
                }),
            ],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([["Buffer", record]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const type = createNormalizedType({
            name: "Buffer",
            isArray: true,
            elementType: createNormalizedType({ name: "Buffer" }),
            fixedSize: 2,
        });
        const result = mapper.mapType(type);

        if (result.ffi.type === "array") {
            expect(result.ffi.elementSize).toBe(4);
        }
    });
});

describe("FfiMapper - branch coverage / mapType - trampoline FFI descriptor", () => {
    it("records the user_data index on a callback trampoline descriptor", () => {
        const callback = createNormalizedCallback({
            name: "ForEach",
            qualifiedName: qualifiedName("Gtk", "ForEach"),
            parameters: [
                createNormalizedParameter({ name: "value", type: createNormalizedType({ name: "gint" }) }),
                createNormalizedParameter({ name: "user_data", type: createNormalizedType({ name: "gpointer" }) }),
            ],
            returnType: createNormalizedType({ name: "gboolean" }),
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            callbacks: new Map([["ForEach", callback]]),
        });
        const { mapper } = createTestSetup(new Map([["Gtk", ns]]));

        const param = createNormalizedParameter({
            name: "callback",
            type: createNormalizedType({ name: "ForEach" }),
        });
        const result = mapper.mapParameter(param);

        expect(result.ffi.type).toBe("trampoline");
        if (result.ffi.type === "trampoline") {
            expect(result.ffi.userDataIndex).toBe(1);
            expect(result.ffi.returnType?.type).toBe("boolean");
        }
    });
});
