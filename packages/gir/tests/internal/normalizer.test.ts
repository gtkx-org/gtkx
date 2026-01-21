import { describe, expect, it } from "vitest";
import { type NormalizerContext, normalizeNamespace } from "../../src/internal/normalizer.js";
import type { RawNamespace } from "../../src/internal/raw-types.js";

const createRawNamespace = (overrides: Partial<RawNamespace> = {}): RawNamespace => ({
    name: "Test",
    version: "1.0",
    sharedLibrary: "libtest.so",
    cPrefix: "Test",
    classes: [],
    interfaces: [],
    records: [],
    enumerations: [],
    bitfields: [],
    callbacks: [],
    functions: [],
    constants: [],
    aliases: [],
    doc: undefined,
    ...overrides,
});

const createContext = (namespaces: RawNamespace[] = []): NormalizerContext => {
    const map = new Map<string, RawNamespace>();
    for (const ns of namespaces) {
        map.set(ns.name, ns);
    }
    return { rawNamespaces: map };
};

describe("normalizeNamespace", () => {
    it("normalizes basic namespace metadata", () => {
        const raw = createRawNamespace({
            name: "Gtk",
            version: "4.0",
            sharedLibrary: "libgtk-4.so.1",
            cPrefix: "Gtk",
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        expect(result.name).toBe("Gtk");
        expect(result.version).toBe("4.0");
        expect(result.sharedLibrary).toBe("libgtk-4.so.1");
        expect(result.cPrefix).toBe("Gtk");
    });

    it("normalizes classes with qualified names", () => {
        const raw = createRawNamespace({
            name: "Gtk",
            classes: [
                {
                    name: "Widget",
                    cType: "GtkWidget",
                    parent: "GObject.InitiallyUnowned",
                    abstract: true,
                    glibTypeName: "GtkWidget",
                    glibGetType: "gtk_widget_get_type",
                    cSymbolPrefix: "widget",
                    implements: [],
                    methods: [],
                    constructors: [],
                    functions: [],
                    properties: [],
                    signals: [],
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        expect(result.classes.size).toBe(1);
        const widget = result.classes.get("Widget");
        expect(widget?.qualifiedName).toBe("Gtk.Widget");
        expect(widget?.parent).toBe("GObject.InitiallyUnowned");
        expect(widget?.abstract).toBe(true);
    });

    it("qualifies types within the same namespace", () => {
        const raw = createRawNamespace({
            name: "Gtk",
            classes: [
                {
                    name: "Button",
                    cType: "GtkButton",
                    parent: "Widget",
                    abstract: false,
                    glibTypeName: "GtkButton",
                    glibGetType: "gtk_button_get_type",
                    cSymbolPrefix: "button",
                    implements: [],
                    methods: [],
                    constructors: [],
                    functions: [],
                    properties: [],
                    signals: [],
                    doc: undefined,
                },
                {
                    name: "Widget",
                    cType: "GtkWidget",
                    parent: undefined,
                    abstract: true,
                    glibTypeName: "GtkWidget",
                    glibGetType: "gtk_widget_get_type",
                    cSymbolPrefix: "widget",
                    implements: [],
                    methods: [],
                    constructors: [],
                    functions: [],
                    properties: [],
                    signals: [],
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        const button = result.classes.get("Button");
        expect(button?.parent).toBe("Gtk.Widget");
    });

    it("resolves types from other namespaces", () => {
        const gobject = createRawNamespace({
            name: "GObject",
            classes: [
                {
                    name: "Object",
                    cType: "GObject",
                    parent: undefined,
                    abstract: false,
                    glibTypeName: "GObject",
                    glibGetType: "g_object_get_type",
                    cSymbolPrefix: "object",
                    implements: [],
                    methods: [],
                    constructors: [],
                    functions: [],
                    properties: [],
                    signals: [],
                    doc: undefined,
                },
            ],
        });
        const gtk = createRawNamespace({
            name: "Gtk",
            classes: [
                {
                    name: "Widget",
                    cType: "GtkWidget",
                    parent: "Object",
                    abstract: true,
                    glibTypeName: "GtkWidget",
                    glibGetType: "gtk_widget_get_type",
                    cSymbolPrefix: "widget",
                    implements: [],
                    methods: [],
                    constructors: [],
                    functions: [],
                    properties: [],
                    signals: [],
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([gobject, gtk]);
        const result = normalizeNamespace(gtk, ctx);

        const widget = result.classes.get("Widget");
        expect(widget?.parent).toBe("GObject.Object");
    });

    it("normalizes interfaces", () => {
        const raw = createRawNamespace({
            name: "Gtk",
            interfaces: [
                {
                    name: "Buildable",
                    cType: "GtkBuildable",
                    glibTypeName: "GtkBuildable",
                    prerequisites: [],
                    methods: [],
                    properties: [],
                    signals: [],
                    doc: "Interface for widgets",
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        expect(result.interfaces.size).toBe(1);
        const buildable = result.interfaces.get("Buildable");
        expect(buildable?.qualifiedName).toBe("Gtk.Buildable");
        expect(buildable?.doc).toBe("Interface for widgets");
    });

    it("normalizes records (boxed types)", () => {
        const raw = createRawNamespace({
            name: "Gdk",
            records: [
                {
                    name: "Rectangle",
                    cType: "GdkRectangle",
                    opaque: false,
                    disguised: false,
                    glibTypeName: "GdkRectangle",
                    glibGetType: "gdk_rectangle_get_type",
                    fields: [
                        { name: "x", type: { name: "gint", cType: "gint" }, writable: true },
                        { name: "y", type: { name: "gint", cType: "gint" }, writable: true },
                    ],
                    methods: [],
                    constructors: [],
                    functions: [],
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        expect(result.records.size).toBe(1);
        const rect = result.records.get("Rectangle");
        expect(rect?.qualifiedName).toBe("Gdk.Rectangle");
        expect(rect?.isBoxed()).toBe(true);
        expect(rect?.fields.length).toBe(2);
    });

    it("normalizes enumerations", () => {
        const raw = createRawNamespace({
            name: "Gtk",
            enumerations: [
                {
                    name: "Orientation",
                    cType: "GtkOrientation",
                    members: [
                        { name: "horizontal", value: "0", cIdentifier: "GTK_ORIENTATION_HORIZONTAL", doc: undefined },
                        { name: "vertical", value: "1", cIdentifier: "GTK_ORIENTATION_VERTICAL", doc: undefined },
                    ],
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        expect(result.enumerations.size).toBe(1);
        const orientation = result.enumerations.get("Orientation");
        expect(orientation?.qualifiedName).toBe("Gtk.Orientation");
        expect(orientation?.members.length).toBe(2);
        expect(orientation?.members[0].name).toBe("horizontal");
    });

    it("normalizes bitfields (flags)", () => {
        const raw = createRawNamespace({
            name: "Gdk",
            bitfields: [
                {
                    name: "ModifierType",
                    cType: "GdkModifierType",
                    members: [
                        { name: "shift_mask", value: "1", cIdentifier: "GDK_SHIFT_MASK", doc: undefined },
                        { name: "control_mask", value: "4", cIdentifier: "GDK_CONTROL_MASK", doc: undefined },
                    ],
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        expect(result.bitfields.size).toBe(1);
        const modType = result.bitfields.get("ModifierType");
        expect(modType?.qualifiedName).toBe("Gdk.ModifierType");
    });

    it("normalizes callbacks", () => {
        const raw = createRawNamespace({
            name: "Gio",
            callbacks: [
                {
                    name: "AsyncReadyCallback",
                    cType: "GAsyncReadyCallback",
                    returnType: { name: "none", cType: "void" },
                    parameters: [
                        { name: "source_object", type: { name: "GObject.Object", cType: "GObject*" } },
                        { name: "res", type: { name: "AsyncResult", cType: "GAsyncResult*" } },
                    ],
                    doc: undefined,
                },
            ],
            interfaces: [
                {
                    name: "AsyncResult",
                    cType: "GAsyncResult",
                    glibTypeName: "GAsyncResult",
                    prerequisites: [],
                    methods: [],
                    properties: [],
                    signals: [],
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        expect(result.callbacks.size).toBe(1);
        const callback = result.callbacks.get("AsyncReadyCallback");
        expect(callback?.qualifiedName).toBe("Gio.AsyncReadyCallback");
        expect(callback?.parameters.length).toBe(2);
        expect(callback?.parameters[1].type.name).toBe("Gio.AsyncResult");
    });

    it("normalizes functions", () => {
        const raw = createRawNamespace({
            name: "Gtk",
            functions: [
                {
                    name: "init",
                    cIdentifier: "gtk_init",
                    returnType: { name: "none", cType: "void" },
                    parameters: [],
                    throws: false,
                    doc: "Initializes GTK",
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        expect(result.functions.size).toBe(1);
        const init = result.functions.get("init");
        expect(init?.cIdentifier).toBe("gtk_init");
        expect(init?.doc).toBe("Initializes GTK");
    });

    it("normalizes constants", () => {
        const raw = createRawNamespace({
            name: "Gtk",
            constants: [
                {
                    name: "MAJOR_VERSION",
                    cType: "GTK_MAJOR_VERSION",
                    value: "4",
                    type: { name: "gint", cType: "gint" },
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        expect(result.constants.size).toBe(1);
        const major = result.constants.get("MAJOR_VERSION");
        expect(major?.qualifiedName).toBe("Gtk.MAJOR_VERSION");
        expect(major?.value).toBe("4");
    });

    it("keeps intrinsic types unqualified", () => {
        const raw = createRawNamespace({
            name: "Test",
            functions: [
                {
                    name: "add",
                    cIdentifier: "test_add",
                    returnType: { name: "gint", cType: "gint" },
                    parameters: [
                        { name: "a", type: { name: "gint", cType: "gint" } },
                        { name: "b", type: { name: "gint", cType: "gint" } },
                    ],
                    throws: false,
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        const add = result.functions.get("add");
        expect(add?.returnType.name).toBe("gint");
        expect(add?.parameters[0].type.name).toBe("gint");
    });

    it("normalizes array types with element type", () => {
        const raw = createRawNamespace({
            name: "Gtk",
            functions: [
                {
                    name: "get_css_classes",
                    cIdentifier: "gtk_widget_get_css_classes",
                    returnType: {
                        name: "array",
                        cType: "char**",
                        isArray: true,
                        elementType: { name: "utf8", cType: "char*" },
                    },
                    parameters: [],
                    throws: false,
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        const getCssClasses = result.functions.get("get_css_classes");
        expect(getCssClasses?.returnType.isArray).toBe(true);
        expect(getCssClasses?.returnType.elementType?.name).toBe("utf8");
    });

    it("normalizes method with throws", () => {
        const raw = createRawNamespace({
            name: "Gio",
            classes: [
                {
                    name: "File",
                    cType: "GFile",
                    parent: undefined,
                    abstract: false,
                    glibTypeName: "GFile",
                    glibGetType: "g_file_get_type",
                    cSymbolPrefix: "file",
                    implements: [],
                    methods: [
                        {
                            name: "load_contents",
                            cIdentifier: "g_file_load_contents",
                            returnType: { name: "gboolean", cType: "gboolean" },
                            parameters: [],
                            throws: true,
                            doc: undefined,
                        },
                    ],
                    constructors: [],
                    functions: [],
                    properties: [],
                    signals: [],
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        const file = result.classes.get("File");
        expect(file?.methods[0].throws).toBe(true);
    });

    it("normalizes properties", () => {
        const raw = createRawNamespace({
            name: "Gtk",
            classes: [
                {
                    name: "Widget",
                    cType: "GtkWidget",
                    parent: undefined,
                    abstract: true,
                    glibTypeName: "GtkWidget",
                    glibGetType: "gtk_widget_get_type",
                    cSymbolPrefix: "widget",
                    implements: [],
                    methods: [],
                    constructors: [],
                    functions: [],
                    properties: [
                        {
                            name: "visible",
                            type: { name: "gboolean", cType: "gboolean" },
                            readable: true,
                            writable: true,
                            constructOnly: false,
                            hasDefault: true,
                            getter: "get_visible",
                            setter: "set_visible",
                            doc: "Widget visibility",
                        },
                    ],
                    signals: [],
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        const widget = result.classes.get("Widget");
        expect(widget?.properties.length).toBe(1);
        expect(widget?.properties[0].name).toBe("visible");
        expect(widget?.properties[0].readable).toBe(true);
        expect(widget?.properties[0].writable).toBe(true);
        expect(widget?.properties[0].getter).toBe("get_visible");
    });

    it("normalizes signals", () => {
        const raw = createRawNamespace({
            name: "Gtk",
            classes: [
                {
                    name: "Button",
                    cType: "GtkButton",
                    parent: undefined,
                    abstract: false,
                    glibTypeName: "GtkButton",
                    glibGetType: "gtk_button_get_type",
                    cSymbolPrefix: "button",
                    implements: [],
                    methods: [],
                    constructors: [],
                    functions: [],
                    properties: [],
                    signals: [
                        {
                            name: "clicked",
                            when: "first",
                            returnType: { name: "none", cType: "void" },
                            parameters: [],
                            doc: "Emitted when button is clicked",
                        },
                    ],
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        const button = result.classes.get("Button");
        expect(button?.signals.length).toBe(1);
        expect(button?.signals[0].name).toBe("clicked");
        expect(button?.signals[0].when).toBe("first");
    });

    it("normalizes implements list with qualified names", () => {
        const raw = createRawNamespace({
            name: "Gtk",
            classes: [
                {
                    name: "Widget",
                    cType: "GtkWidget",
                    parent: undefined,
                    abstract: true,
                    glibTypeName: "GtkWidget",
                    glibGetType: "gtk_widget_get_type",
                    cSymbolPrefix: "widget",
                    implements: ["Buildable", "Accessible"],
                    methods: [],
                    constructors: [],
                    functions: [],
                    properties: [],
                    signals: [],
                    doc: undefined,
                },
            ],
            interfaces: [
                {
                    name: "Buildable",
                    cType: "GtkBuildable",
                    glibTypeName: "GtkBuildable",
                    prerequisites: [],
                    methods: [],
                    properties: [],
                    signals: [],
                    doc: undefined,
                },
                {
                    name: "Accessible",
                    cType: "GtkAccessible",
                    glibTypeName: "GtkAccessible",
                    prerequisites: [],
                    methods: [],
                    properties: [],
                    signals: [],
                    doc: undefined,
                },
            ],
        });
        const ctx = createContext([raw]);
        const result = normalizeNamespace(raw, ctx);

        const widget = result.classes.get("Widget");
        expect(widget?.implements).toEqual(["Gtk.Buildable", "Gtk.Accessible"]);
    });
});
