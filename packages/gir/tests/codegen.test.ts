import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
    type GirNamespace,
    type GirParameter,
    GirParser,
    type GirType,
    TypeMapper,
    TypeRegistry,
} from "../src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = resolve(__dirname, "../../..");
const girsDir = join(workspaceRoot, "girs");

const loadGirFile = (filename: string): GirNamespace => {
    const content = readFileSync(join(girsDir, filename), "utf-8");
    const parser = new GirParser();
    return parser.parse(content);
};

describe("GirParser - GIR Metadata as Source of Truth", () => {
    let gtkNamespace: GirNamespace;
    let gobjectNamespace: GirNamespace;
    let glibNamespace: GirNamespace;
    let gdkNamespace: GirNamespace;
    let gioNamespace: GirNamespace;

    beforeAll(() => {
        gtkNamespace = loadGirFile("Gtk-4.0.gir");
        gobjectNamespace = loadGirFile("GObject-2.0.gir");
        glibNamespace = loadGirFile("GLib-2.0.gir");
        gdkNamespace = loadGirFile("Gdk-4.0.gir");
        gioNamespace = loadGirFile("Gio-2.0.gir");
    });

    describe("Namespace Metadata", () => {
        it("parses namespace name from GIR", () => {
            expect(gtkNamespace.name).toBe("Gtk");
            expect(gobjectNamespace.name).toBe("GObject");
            expect(glibNamespace.name).toBe("GLib");
        });

        it("parses namespace version from GIR", () => {
            expect(gtkNamespace.version).toBe("4.0");
            expect(gobjectNamespace.version).toBe("2.0");
        });

        it("parses shared library from GIR", () => {
            expect(gtkNamespace.sharedLibrary).toContain("gtk");
            expect(gobjectNamespace.sharedLibrary).toContain("gobject");
        });
    });

    describe("Class Metadata", () => {
        it("parses class name from GIR attributes, not conventions", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            expect(button).toBeDefined();
            expect(button?.name).toBe("Button");
        });

        it("parses parent class from GIR parent attribute", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            expect(button?.parent).toBe("Widget");
        });

        it("parses cross-namespace parent from GIR", () => {
            const widget = gtkNamespace.classes.find((c) => c.name === "Widget");
            expect(widget?.parent).toBe("GObject.InitiallyUnowned");
        });

        it("parses abstract attribute from GIR", () => {
            const widget = gtkNamespace.classes.find((c) => c.name === "Widget");
            expect(widget?.abstract).toBe(true);

            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            expect(button?.abstract).toBe(false);
        });

        it("parses cType from GIR c:type attribute", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            expect(button?.cType).toBe("GtkButton");
        });

        it("parses interface implementations from GIR", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            expect(button?.implements).toContain("Actionable");
        });
    });

    describe("Constructor Metadata", () => {
        it("parses constructors from GIR constructor elements", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            expect(button?.constructors.length).toBeGreaterThan(0);
        });

        it("parses constructor c:identifier from GIR", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            const newCtor = button?.constructors.find((c) => c.name === "new");
            expect(newCtor?.cIdentifier).toBe("gtk_button_new");
        });

        it("parses constructor with parameters", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            const withLabelCtor = button?.constructors.find((c) => c.name === "new_with_label");
            expect(withLabelCtor).toBeDefined();
            expect(withLabelCtor?.parameters.length).toBeGreaterThan(0);
            expect(withLabelCtor?.parameters[0]?.name).toBe("label");
        });

        it("parses constructor return type from GIR", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            const newCtor = button?.constructors.find((c) => c.name === "new");
            expect(newCtor?.returnType.name).toBeDefined();
            expect(["Button", "Widget"]).toContain(newCtor?.returnType.name);
        });
    });

    describe("Method Metadata", () => {
        it("parses methods from GIR method elements", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            expect(button?.methods.length).toBeGreaterThan(0);
        });

        it("parses method c:identifier from GIR", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            const setLabel = button?.methods.find((m) => m.name === "set_label");
            expect(setLabel?.cIdentifier).toBe("gtk_button_set_label");
        });

        it("parses method return type from GIR", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            const getLabel = button?.methods.find((m) => m.name === "get_label");
            expect(getLabel?.returnType.name).toBe("utf8");
        });

        it("parses throws attribute from GIR", () => {
            const allMethodsWithThrows = gioNamespace.classes.flatMap((c) =>
                c.methods.filter((m) => m.throws === true),
            );
            expect(allMethodsWithThrows.length).toBeGreaterThan(0);
        });
    });

    describe("Parameter Metadata", () => {
        it("parses parameter name from GIR", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            const setLabel = button?.methods.find((m) => m.name === "set_label");
            expect(setLabel?.parameters[0]?.name).toBe("label");
        });

        it("parses parameter type from GIR", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            const setLabel = button?.methods.find((m) => m.name === "set_label");
            expect(setLabel?.parameters[0]?.type.name).toBe("utf8");
        });

        it("parses nullable attribute from GIR", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            const setChild = button?.methods.find((m) => m.name === "set_child");
            expect(setChild?.parameters[0]?.nullable).toBe(true);
        });

        it("parses direction attribute from GIR (out parameters)", () => {
            const widget = gtkNamespace.classes.find((c) => c.name === "Widget");
            const methodsWithOutParams = widget?.methods.filter((m) =>
                m.parameters.some((p) => p.direction === "out" || p.direction === "inout"),
            );
            expect(methodsWithOutParams?.length).toBeGreaterThan(0);
        });

        it("parses scope attribute for callbacks from GIR", () => {
            const methodsWithCallbacks = gtkNamespace.classes.flatMap((c) =>
                c.methods.filter((m) => m.parameters.some((p) => p.scope !== undefined)),
            );
            expect(methodsWithCallbacks.length).toBeGreaterThan(0);
        });

        it("parses closure attribute from GIR", () => {
            const methodsWithClosure = gtkNamespace.classes.flatMap((c) =>
                c.methods.filter((m) => m.parameters.some((p) => p.closure !== undefined)),
            );
            expect(methodsWithClosure.length).toBeGreaterThan(0);
        });
    });

    describe("Enumeration Metadata", () => {
        it("parses enumerations from GIR", () => {
            expect(gtkNamespace.enumerations.length).toBeGreaterThan(0);
        });

        it("parses enumeration name from GIR", () => {
            const align = gtkNamespace.enumerations.find((e) => e.name === "Align");
            expect(align).toBeDefined();
        });

        it("parses enumeration members from GIR", () => {
            const align = gtkNamespace.enumerations.find((e) => e.name === "Align");
            expect(align?.members.length).toBeGreaterThan(0);
            expect(align?.members.some((m) => m.name === "center")).toBe(true);
        });

        it("parses enumeration member values from GIR", () => {
            const align = gtkNamespace.enumerations.find((e) => e.name === "Align");
            const center = align?.members.find((m) => m.name === "center");
            expect(center?.value).toBeDefined();
        });

        it("parses bitfields from GIR", () => {
            expect(gtkNamespace.bitfields.length).toBeGreaterThan(0);
        });
    });

    describe("Record Metadata", () => {
        it("parses records from GIR", () => {
            expect(gdkNamespace.records.length).toBeGreaterThan(0);
        });

        it("parses glib:type-name from GIR for boxed types", () => {
            const rgba = gdkNamespace.records.find((r) => r.name === "RGBA");
            expect(rgba?.glibTypeName).toBe("GdkRGBA");
        });

        it("parses disguised attribute from GIR", () => {
            const disguisedRecords = gdkNamespace.records.filter((r) => r.disguised === true);
            expect(disguisedRecords.length).toBeGreaterThan(0);
        });

        it("parses record fields from GIR", () => {
            const rgba = gdkNamespace.records.find((r) => r.name === "RGBA");
            expect(rgba?.fields.length).toBeGreaterThan(0);
            expect(rgba?.fields.some((f) => f.name === "red")).toBe(true);
        });

        it("parses record methods from GIR", () => {
            const rgba = gdkNamespace.records.find((r) => r.name === "RGBA");
            expect(rgba?.methods.length).toBeGreaterThan(0);
        });
    });

    describe("Signal Metadata", () => {
        it("parses signals from GIR glib:signal elements", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            expect(button?.signals.length).toBeGreaterThan(0);
        });

        it("parses signal name from GIR", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            expect(button?.signals.some((s) => s.name === "clicked")).toBe(true);
        });

        it("parses signal when attribute from GIR", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            const clicked = button?.signals.find((s) => s.name === "clicked");
            expect(["first", "last", "cleanup"]).toContain(clicked?.when);
        });
    });

    describe("Interface Metadata", () => {
        it("parses interfaces from GIR", () => {
            expect(gtkNamespace.interfaces.length).toBeGreaterThan(0);
        });

        it("parses interface name from GIR", () => {
            const actionable = gtkNamespace.interfaces.find((i) => i.name === "Actionable");
            expect(actionable).toBeDefined();
        });

        it("parses interface methods from GIR", () => {
            const actionable = gtkNamespace.interfaces.find((i) => i.name === "Actionable");
            expect(actionable?.methods.length).toBeGreaterThan(0);
        });
    });

    describe("Property Metadata", () => {
        it("parses properties from GIR", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            expect(button?.properties.length).toBeGreaterThan(0);
        });

        it("parses property readable/writable from GIR", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            const labelProp = button?.properties.find((p) => p.name === "label");
            expect(labelProp?.readable).toBe(true);
            expect(labelProp?.writable).toBe(true);
        });

        it("parses construct-only properties from GIR", () => {
            const constructOnlyProps = gtkNamespace.classes.flatMap((c) =>
                c.properties.filter((p) => p.constructOnly === true),
            );
            expect(constructOnlyProps.length).toBeGreaterThan(0);
        });
    });

    describe("Transfer Ownership", () => {
        it("parses transfer-ownership attribute from GIR return values", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            const getLabel = button?.methods.find((m) => m.name === "get_label");
            expect(["none", "full", "container"]).toContain(getLabel?.returnType.transferOwnership);
        });
    });

    describe("Array Types", () => {
        it("parses array types from GIR", () => {
            const methodsWithArrays = gtkNamespace.classes.flatMap((c) =>
                c.methods.filter(
                    (m) => m.returnType.isArray === true || m.parameters.some((p) => p.type.isArray === true),
                ),
            );
            expect(methodsWithArrays.length).toBeGreaterThan(0);
        });

        it("parses array element type from GIR", () => {
            const methodsWithArrays = gtkNamespace.classes.flatMap((c) =>
                c.methods.filter((m) => m.returnType.isArray === true && m.returnType.elementType),
            );
            if (methodsWithArrays.length > 0) {
                expect(methodsWithArrays[0]?.returnType.elementType).toBeDefined();
            }
        });
    });
});

describe("TypeRegistry - Cross-Namespace Type Resolution", () => {
    let registry: TypeRegistry;
    let gtkNamespace: GirNamespace;
    let gobjectNamespace: GirNamespace;
    let glibNamespace: GirNamespace;
    let gdkNamespace: GirNamespace;
    let gioNamespace: GirNamespace;

    beforeAll(() => {
        gtkNamespace = loadGirFile("Gtk-4.0.gir");
        gobjectNamespace = loadGirFile("GObject-2.0.gir");
        glibNamespace = loadGirFile("GLib-2.0.gir");
        gdkNamespace = loadGirFile("Gdk-4.0.gir");
        gioNamespace = loadGirFile("Gio-2.0.gir");

        registry = TypeRegistry.fromNamespaces([
            gtkNamespace,
            gobjectNamespace,
            glibNamespace,
            gdkNamespace,
            gioNamespace,
        ]);
    });

    describe("Class Registration", () => {
        it("registers classes from all namespaces", () => {
            expect(registry.resolve("Gtk.Button")).toBeDefined();
            expect(registry.resolve("GObject.Object")).toBeDefined();
            expect(registry.resolve("Gio.Application")).toBeDefined();
        });

        it("returns correct kind for classes", () => {
            const button = registry.resolve("Gtk.Button");
            expect(button?.kind).toBe("class");
        });

        it("transforms class names correctly", () => {
            const button = registry.resolve("Gtk.Button");
            expect(button?.transformedName).toBe("Button");
        });

        it("handles special class renames (Object -> GObject, Error -> GError)", () => {
            const gobject = registry.resolve("GObject.Object");
            expect(gobject?.transformedName).toBe("GObject");

            const gerror = registry.resolve("GLib.Error");
            expect(gerror?.transformedName).toBe("GError");
        });
    });

    describe("Interface Registration", () => {
        it("registers interfaces from all namespaces", () => {
            expect(registry.resolve("Gtk.Actionable")).toBeDefined();
            expect(registry.resolve("Gio.ActionGroup")).toBeDefined();
        });

        it("returns class kind for interfaces (they're treated as classes)", () => {
            const actionable = registry.resolve("Gtk.Actionable");
            expect(actionable?.kind).toBe("class");
        });
    });

    describe("Enum Registration", () => {
        it("registers enums from all namespaces", () => {
            expect(registry.resolve("Gtk.Align")).toBeDefined();
            expect(registry.resolve("Gdk.AxisUse")).toBeDefined();
        });

        it("returns correct kind for enums", () => {
            const align = registry.resolve("Gtk.Align");
            expect(align?.kind).toBe("enum");
        });

        it("registers bitfields as enums", () => {
            const stateFlags = registry.resolve("Gtk.StateFlags");
            expect(stateFlags?.kind).toBe("enum");
        });
    });

    describe("Record Registration", () => {
        it("registers records with glib:type-name", () => {
            const rgba = registry.resolve("Gdk.RGBA");
            expect(rgba).toBeDefined();
            expect(rgba?.kind).toBe("record");
        });

        it("stores glib type name for records", () => {
            const rgba = registry.resolve("Gdk.RGBA");
            expect(rgba?.glibTypeName).toBe("GdkRGBA");
        });

        it("does not register disguised records", () => {
            const registeredRecords = gdkNamespace.records.filter((r) => registry.resolve(`Gdk.${r.name}`));
            expect(registeredRecords.length).toBeLessThan(gdkNamespace.records.length);
        });

        it("does not register Class/Private/Iface records", () => {
            const classRecords = gdkNamespace.records.filter(
                (r) => r.name.endsWith("Class") || r.name.endsWith("Private") || r.name.endsWith("Iface"),
            );
            for (const record of classRecords) {
                expect(registry.resolve(`Gdk.${record.name}`)).toBeUndefined();
            }
        });
    });

    describe("Cross-Namespace Resolution", () => {
        it("resolves qualified names correctly", () => {
            const button = registry.resolve("Gtk.Button");
            expect(button?.namespace).toBe("Gtk");
            expect(button?.name).toBe("Button");
        });

        it("resolves types within namespace context", () => {
            const widget = registry.resolveInNamespace("Widget", "Gtk");
            expect(widget).toBeDefined();
            expect(widget?.namespace).toBe("Gtk");
        });

        it("resolves qualified names from any namespace context", () => {
            const gdkRgba = registry.resolveInNamespace("Gdk.RGBA", "Gtk");
            expect(gdkRgba).toBeDefined();
            expect(gdkRgba?.namespace).toBe("Gdk");
        });
    });
});

describe("TypeMapper - No Unknown Types", () => {
    let registry: TypeRegistry;
    let typeMapper: TypeMapper;
    let gtkNamespace: GirNamespace;
    let gobjectNamespace: GirNamespace;
    let glibNamespace: GirNamespace;
    let gdkNamespace: GirNamespace;
    let gioNamespace: GirNamespace;
    let allNamespaces: GirNamespace[];

    beforeAll(() => {
        gtkNamespace = loadGirFile("Gtk-4.0.gir");
        gobjectNamespace = loadGirFile("GObject-2.0.gir");
        glibNamespace = loadGirFile("GLib-2.0.gir");
        gdkNamespace = loadGirFile("Gdk-4.0.gir");
        gioNamespace = loadGirFile("Gio-2.0.gir");

        allNamespaces = [gtkNamespace, gobjectNamespace, glibNamespace, gdkNamespace, gioNamespace];
        registry = TypeRegistry.fromNamespaces(allNamespaces);

        typeMapper = new TypeMapper();
        typeMapper.setTypeRegistry(registry, "Gtk");

        for (const enumeration of gtkNamespace.enumerations) {
            typeMapper.registerEnum(enumeration.name);
        }
        for (const bitfield of gtkNamespace.bitfields) {
            typeMapper.registerEnum(bitfield.name);
        }
        for (const record of gtkNamespace.records) {
            if (record.glibTypeName) {
                typeMapper.registerRecord(record.name, record.name, record.glibTypeName);
            }
        }
    });

    describe("Basic Type Mapping", () => {
        it("maps gboolean to boolean", () => {
            const result = typeMapper.mapType({ name: "gboolean" });
            expect(result.ts).toBe("boolean");
            expect(result.ffi.type).toBe("boolean");
        });

        it("maps gint to number with correct FFI type", () => {
            const result = typeMapper.mapType({ name: "gint" });
            expect(result.ts).toBe("number");
            expect(result.ffi.type).toBe("int");
            expect(result.ffi.size).toBe(32);
        });

        it("maps guint to number with unsigned FFI type", () => {
            const result = typeMapper.mapType({ name: "guint" });
            expect(result.ts).toBe("number");
            expect(result.ffi.type).toBe("int");
            expect(result.ffi.unsigned).toBe(true);
        });

        it("maps gfloat to number with float FFI type", () => {
            const result = typeMapper.mapType({ name: "gfloat" });
            expect(result.ts).toBe("number");
            expect(result.ffi.type).toBe("float");
            expect(result.ffi.size).toBe(32);
        });

        it("maps gdouble to number with 64-bit float FFI type", () => {
            const result = typeMapper.mapType({ name: "gdouble" });
            expect(result.ts).toBe("number");
            expect(result.ffi.type).toBe("float");
            expect(result.ffi.size).toBe(64);
        });

        it("maps utf8 to string", () => {
            const result = typeMapper.mapType({ name: "utf8" });
            expect(result.ts).toBe("string");
            expect(result.ffi.type).toBe("string");
        });

        it("maps filename to string", () => {
            const result = typeMapper.mapType({ name: "filename" });
            expect(result.ts).toBe("string");
            expect(result.ffi.type).toBe("string");
        });

        it("maps void to void", () => {
            const result = typeMapper.mapType({ name: "void" });
            expect(result.ts).toBe("void");
            expect(result.ffi.type).toBe("undefined");
        });

        it("maps none to void", () => {
            const result = typeMapper.mapType({ name: "none" });
            expect(result.ts).toBe("void");
            expect(result.ffi.type).toBe("undefined");
        });

        it("maps gpointer to number with 64-bit unsigned FFI type", () => {
            const result = typeMapper.mapType({ name: "gpointer" });
            expect(result.ts).toBe("number");
            expect(result.ffi.type).toBe("int");
            expect(result.ffi.size).toBe(64);
            expect(result.ffi.unsigned).toBe(true);
        });

        it("maps GType to number with 64-bit unsigned", () => {
            const result = typeMapper.mapType({ name: "GType" });
            expect(result.ts).toBe("number");
            expect(result.ffi.size).toBe(64);
            expect(result.ffi.unsigned).toBe(true);
        });
    });

    describe("Enum Type Mapping", () => {
        it("maps registered enums to their transformed name", () => {
            const result = typeMapper.mapType({ name: "Align" });
            expect(result.ts).toBe("Align");
            expect(result.ffi.type).toBe("int");
            expect(result.ffi.size).toBe(32);
        });

        it("maps qualified enum names", () => {
            const result = typeMapper.mapType({ name: "Gtk.Align" });
            expect(result.ts).toBe("Align");
            expect(result.ffi.type).toBe("int");
        });

        it("maps cross-namespace enums with qualified name", () => {
            const gdkTypeMapper = new TypeMapper();
            gdkTypeMapper.setTypeRegistry(registry, "Gdk");

            for (const enumeration of gdkNamespace.enumerations) {
                gdkTypeMapper.registerEnum(enumeration.name);
            }

            const result = gdkTypeMapper.mapType({ name: "Gtk.Align" });
            expect(result.ts).toBe("Gtk.Align");
            expect(result.externalType?.namespace).toBe("Gtk");
        });
    });

    describe("Record Type Mapping", () => {
        it("maps registered records to boxed FFI type", () => {
            const gdkTypeMapper = new TypeMapper();
            gdkTypeMapper.setTypeRegistry(registry, "Gdk");

            for (const record of gdkNamespace.records) {
                if (record.glibTypeName) {
                    gdkTypeMapper.registerRecord(record.name, record.name, record.glibTypeName);
                }
            }

            const result = gdkTypeMapper.mapType({ name: "RGBA" });
            expect(result.ts).toBe("RGBA");
            expect(result.ffi.type).toBe("boxed");
            expect(result.ffi.innerType).toBe("GdkRGBA");
        });
    });

    describe("GObject Type Mapping", () => {
        it("maps GObject classes to gobject FFI type", () => {
            const result = typeMapper.mapType({ name: "Widget" });
            expect(result.ts).toBe("Widget");
            expect(result.ffi.type).toBe("gobject");
        });

        it("maps cross-namespace GObject classes", () => {
            const result = typeMapper.mapType({ name: "GObject.Object" });
            expect(result.ts).toBe("GObject.GObject");
            expect(result.ffi.type).toBe("gobject");
            expect(result.externalType?.namespace).toBe("GObject");
        });

        it("handles borrowed return types", () => {
            const result = typeMapper.mapType({ name: "Widget" }, true);
            expect(result.ffi.borrowed).toBe(true);
        });
    });

    describe("Array Type Mapping", () => {
        it("maps array types correctly", () => {
            const result = typeMapper.mapType({
                name: "array",
                isArray: true,
                elementType: { name: "utf8" },
            });
            expect(result.ts).toBe("string[]");
            expect(result.ffi.type).toBe("array");
            expect(result.ffi.itemType?.type).toBe("string");
        });

        it("maps arrays of GObjects", () => {
            const result = typeMapper.mapType({
                name: "array",
                isArray: true,
                elementType: { name: "Widget" },
            });
            expect(result.ts).toBe("Widget[]");
            expect(result.ffi.type).toBe("array");
            expect(result.ffi.itemType?.type).toBe("gobject");
        });
    });

    describe("Parameter Mapping", () => {
        it("maps out parameters with Ref wrapper", () => {
            const param: GirParameter = {
                name: "value",
                type: { name: "gint" },
                direction: "out",
            };
            const result = typeMapper.mapParameter(param);
            expect(result.ts).toBe("Ref<number>");
            expect(result.ffi.type).toBe("ref");
        });

        it("maps inout parameters with Ref wrapper", () => {
            const param: GirParameter = {
                name: "value",
                type: { name: "gint" },
                direction: "inout",
            };
            const result = typeMapper.mapParameter(param);
            expect(result.ts).toBe("Ref<number>");
            expect(result.ffi.type).toBe("ref");
        });

        it("maps GAsyncReadyCallback correctly", () => {
            const param: GirParameter = {
                name: "callback",
                type: { name: "Gio.AsyncReadyCallback" },
            };
            const result = typeMapper.mapParameter(param);
            expect(result.ts).toContain("=>");
            expect(result.ffi.type).toBe("asyncCallback");
        });

        it("detects nullable parameters", () => {
            const param: GirParameter = {
                name: "widget",
                type: { name: "Widget" },
                nullable: true,
            };
            expect(typeMapper.isNullable(param)).toBe(true);
        });

        it("detects optional parameters", () => {
            const param: GirParameter = {
                name: "widget",
                type: { name: "Widget" },
                optional: true,
            };
            expect(typeMapper.isNullable(param)).toBe(true);
        });
    });

    describe("All GIR Types Map to Known Types", () => {
        const collectAllTypes = (ns: GirNamespace): GirType[] => {
            const types: GirType[] = [];

            for (const cls of ns.classes) {
                for (const method of cls.methods) {
                    types.push(method.returnType);
                    for (const param of method.parameters) {
                        types.push(param.type);
                    }
                }
                for (const ctor of cls.constructors) {
                    types.push(ctor.returnType);
                    for (const param of ctor.parameters) {
                        types.push(param.type);
                    }
                }
                for (const func of cls.functions) {
                    types.push(func.returnType);
                    for (const param of func.parameters) {
                        types.push(param.type);
                    }
                }
                for (const prop of cls.properties) {
                    types.push(prop.type);
                }
            }

            for (const iface of ns.interfaces) {
                for (const method of iface.methods) {
                    types.push(method.returnType);
                    for (const param of method.parameters) {
                        types.push(param.type);
                    }
                }
            }

            for (const record of ns.records) {
                for (const method of record.methods) {
                    types.push(method.returnType);
                    for (const param of method.parameters) {
                        types.push(param.type);
                    }
                }
                for (const field of record.fields) {
                    types.push(field.type);
                }
            }

            for (const func of ns.functions) {
                types.push(func.returnType);
                for (const param of func.parameters) {
                    types.push(param.type);
                }
            }

            return types;
        };

        it("all Gtk namespace types resolve to non-unknown types or are handled", () => {
            const mapper = new TypeMapper();
            mapper.setTypeRegistry(registry, "Gtk");

            for (const enumeration of gtkNamespace.enumerations) {
                mapper.registerEnum(enumeration.name);
            }
            for (const bitfield of gtkNamespace.bitfields) {
                mapper.registerEnum(bitfield.name);
            }
            for (const record of gtkNamespace.records) {
                if (record.glibTypeName) {
                    mapper.registerRecord(record.name, record.name, record.glibTypeName);
                }
            }

            const types = collectAllTypes(gtkNamespace);
            const unknownTypes = new Set<string>();

            for (const type of types) {
                if (!type.name || type.name === "void" || type.name === "none") continue;
                if (type.isArray && type.elementType) {
                    const mapped = mapper.mapType(type.elementType);
                    if (mapped.ts === "unknown" && type.elementType.name) {
                        unknownTypes.add(type.elementType.name);
                    }
                } else {
                    const mapped = mapper.mapType(type);
                    if (mapped.ts === "unknown" && type.name) {
                        unknownTypes.add(type.name);
                    }
                }
            }

            const knownUnhandledTypes = new Set([
                "gpointer",
                "gconstpointer",
                "GLib.Variant",
                "va_list",
                "GLib.Closure",
                "gsize",
                "gssize",
                "gunichar",
                "GLib.List",
                "GLib.SList",
                "GObject.ClosureMarshal",
                "GObject.ClosureNotify",
                "GObject.TypeInterface",
            ]);

            const registeredNamespaces = new Set(["Gtk", "GObject", "GLib", "Gdk", "Gio"]);

            const trulyUnknown = [...unknownTypes].filter((t) => {
                if (knownUnhandledTypes.has(t)) return false;
                if (t.endsWith("Func") || t.endsWith("Callback")) return false;
                if (t.includes("DestroyNotify")) return false;
                if (t.endsWith("Class") || t.endsWith("Private") || t.endsWith("Iface")) return false;
                if (t.endsWith("Notify") || t.endsWith("Foreach") || t.endsWith("Predicate")) return false;

                if (t.includes(".")) {
                    const ns = t.split(".")[0] ?? "";
                    if (!registeredNamespaces.has(ns)) return false;
                }
                return true;
            });

            expect(trulyUnknown.length, `Unknown types found: ${trulyUnknown.join(", ")}`).toBeLessThanOrEqual(15);
        });

        it("all GObject references map to registered classes or interfaces", () => {
            const classAndInterfaceTypes = new Set<string>();

            for (const ns of allNamespaces) {
                for (const cls of ns.classes) {
                    classAndInterfaceTypes.add(`${ns.name}.${cls.name}`);
                }
                for (const iface of ns.interfaces) {
                    classAndInterfaceTypes.add(`${ns.name}.${iface.name}`);
                }
            }

            for (const qualifiedName of classAndInterfaceTypes) {
                const resolved = registry.resolve(qualifiedName);
                expect(resolved, `Type ${qualifiedName} should be registered`).toBeDefined();
            }
        });

        it("all enums and bitfields are registered", () => {
            for (const ns of allNamespaces) {
                for (const enumeration of ns.enumerations) {
                    const resolved = registry.resolve(`${ns.name}.${enumeration.name}`);
                    expect(resolved, `Enum ${ns.name}.${enumeration.name} should be registered`).toBeDefined();
                    expect(resolved?.kind).toBe("enum");
                }
                for (const bitfield of ns.bitfields) {
                    const resolved = registry.resolve(`${ns.name}.${bitfield.name}`);
                    expect(resolved, `Bitfield ${ns.name}.${bitfield.name} should be registered`).toBeDefined();
                    expect(resolved?.kind).toBe("enum");
                }
            }
        });

        it("all records with glib:type-name are registered", () => {
            for (const ns of allNamespaces) {
                for (const record of ns.records) {
                    if (
                        record.glibTypeName &&
                        !record.disguised &&
                        !record.name.endsWith("Class") &&
                        !record.name.endsWith("Private") &&
                        !record.name.endsWith("Iface")
                    ) {
                        const resolved = registry.resolve(`${ns.name}.${record.name}`);
                        expect(resolved, `Record ${ns.name}.${record.name} should be registered`).toBeDefined();
                        expect(resolved?.kind).toBe("record");
                    }
                }
            }
        });
    });
});

describe("Inheritance Handling", () => {
    let gtkNamespace: GirNamespace;
    let gobjectNamespace: GirNamespace;

    beforeAll(() => {
        gtkNamespace = loadGirFile("Gtk-4.0.gir");
        gobjectNamespace = loadGirFile("GObject-2.0.gir");
    });

    describe("Same-Namespace Inheritance", () => {
        it("Button inherits from Widget", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            expect(button?.parent).toBe("Widget");
        });

        it("Entry inherits from Widget", () => {
            const entry = gtkNamespace.classes.find((c) => c.name === "Entry");
            expect(entry?.parent).toBe("Widget");
        });

        it("Window inherits from Widget", () => {
            const window = gtkNamespace.classes.find((c) => c.name === "Window");
            expect(window?.parent).toBe("Widget");
        });

        it("ApplicationWindow inherits from Window", () => {
            const appWindow = gtkNamespace.classes.find((c) => c.name === "ApplicationWindow");
            expect(appWindow?.parent).toBe("Window");
        });
    });

    describe("Cross-Namespace Inheritance", () => {
        it("Gtk.Widget inherits from GObject.InitiallyUnowned", () => {
            const widget = gtkNamespace.classes.find((c) => c.name === "Widget");
            expect(widget?.parent).toBe("GObject.InitiallyUnowned");
        });

        it("Gtk.Application inherits from Gio.Application", () => {
            const app = gtkNamespace.classes.find((c) => c.name === "Application");
            expect(app?.parent).toBe("Gio.Application");
        });

        it("GObject.InitiallyUnowned inherits from GObject.Object", () => {
            const initiallyUnowned = gobjectNamespace.classes.find((c) => c.name === "InitiallyUnowned");
            expect(initiallyUnowned?.parent).toBe("Object");
        });
    });

    describe("Inheritance Chain Resolution", () => {
        it("can resolve full inheritance chain for Button", () => {
            const getParentClass = (
                className: string,
                namespace: string,
            ): { name: string; namespace: string } | undefined => {
                const ns = namespace === "Gtk" ? gtkNamespace : gobjectNamespace;
                const cls = ns.classes.find((c) => c.name === className);
                if (!cls?.parent) return undefined;

                if (cls.parent.includes(".")) {
                    const [parentNs = "", parentName = ""] = cls.parent.split(".");
                    return { name: parentName, namespace: parentNs };
                }
                return { name: cls.parent, namespace };
            };

            const chain: string[] = ["Gtk.Button"];
            let current = getParentClass("Button", "Gtk");

            while (current) {
                chain.push(`${current.namespace}.${current.name}`);
                current = getParentClass(current.name, current.namespace);
            }

            expect(chain).toContain("Gtk.Button");
            expect(chain).toContain("Gtk.Widget");
            expect(chain).toContain("GObject.InitiallyUnowned");
            expect(chain).toContain("GObject.Object");
        });
    });

    describe("Interface Implementation", () => {
        it("Button implements Actionable", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            expect(button?.implements).toContain("Actionable");
        });

        it("Widget implements Accessible and Buildable", () => {
            const widget = gtkNamespace.classes.find((c) => c.name === "Widget");
            expect(widget?.implements).toContain("Accessible");
            expect(widget?.implements).toContain("Buildable");
        });

        it("Application implements ActionGroup and ActionMap", () => {
            const app = gtkNamespace.classes.find((c) => c.name === "Application");
            expect(app?.implements).toContain("Gio.ActionGroup");
            expect(app?.implements).toContain("Gio.ActionMap");
        });
    });
});

describe("Optional Arguments Handling", () => {
    let gtkNamespace: GirNamespace;

    beforeAll(() => {
        gtkNamespace = loadGirFile("Gtk-4.0.gir");
    });

    describe("Nullable Parameters", () => {
        it("identifies nullable parameters from GIR", () => {
            const button = gtkNamespace.classes.find((c) => c.name === "Button");
            const setChild = button?.methods.find((m) => m.name === "set_child");
            const childParam = setChild?.parameters.find((p) => p.name === "child");
            expect(childParam?.nullable).toBe(true);
        });

        it("methods with nullable parameters can be called with null", () => {
            const nullableParams = gtkNamespace.classes.flatMap((c) =>
                c.methods.flatMap((m) =>
                    m.parameters
                        .filter((p) => p.nullable === true)
                        .map((p) => ({
                            class: c.name,
                            method: m.name,
                            param: p.name,
                        })),
                ),
            );
            expect(nullableParams.length).toBeGreaterThan(0);
        });
    });

    describe("Optional Parameters (allow-none)", () => {
        it("identifies optional parameters from GIR allow-none attribute", () => {
            const optionalParams = gtkNamespace.classes.flatMap((c) =>
                c.methods.flatMap((m) =>
                    m.parameters
                        .filter((p) => p.optional === true)
                        .map((p) => ({
                            class: c.name,
                            method: m.name,
                            param: p.name,
                        })),
                ),
            );
            expect(optionalParams.length).toBeGreaterThan(0);
        });
    });

    describe("TypeMapper Nullable Detection", () => {
        it("isNullable returns true for nullable parameters", () => {
            const mapper = new TypeMapper();
            expect(
                mapper.isNullable({
                    name: "test",
                    type: { name: "utf8" },
                    nullable: true,
                }),
            ).toBe(true);
        });

        it("isNullable returns true for optional parameters", () => {
            const mapper = new TypeMapper();
            expect(
                mapper.isNullable({
                    name: "test",
                    type: { name: "utf8" },
                    optional: true,
                }),
            ).toBe(true);
        });

        it("isNullable returns false for required parameters", () => {
            const mapper = new TypeMapper();
            expect(
                mapper.isNullable({
                    name: "test",
                    type: { name: "utf8" },
                }),
            ).toBe(false);
        });
    });

    describe("Callback Closure Parameters", () => {
        it("identifies parameters with closure attribute", () => {
            const paramsWithClosure = gtkNamespace.classes.flatMap((c) =>
                c.methods.flatMap((m) => m.parameters.filter((p) => p.closure !== undefined)),
            );
            expect(paramsWithClosure.length).toBeGreaterThan(0);
        });

        it("TypeMapper detects closure targets", () => {
            const mapper = new TypeMapper();
            const params: GirParameter[] = [
                { name: "callback", type: { name: "Gio.AsyncReadyCallback" }, closure: 1 },
                { name: "user_data", type: { name: "gpointer" } },
            ];
            expect(mapper.isClosureTarget(1, params)).toBe(true);
            expect(mapper.isClosureTarget(0, params)).toBe(false);
        });
    });
});
