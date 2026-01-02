import { beforeEach, describe, expect, it, vi } from "vitest";
import { GirRepository } from "../src/repository.js";
import type { QualifiedName } from "../src/types.js";

vi.mock("node:fs/promises", () => ({
    readdir: vi.fn(),
    readFile: vi.fn(),
}));

const createMinimalGir = (name: string, version: string, content: string) => `<?xml version="1.0"?>
<repository version="1.2" xmlns="http://www.gtk.org/introspection/core/1.0"
    xmlns:c="http://www.gtk.org/introspection/c/1.0"
    xmlns:glib="http://www.gtk.org/introspection/glib/1.0">
    <namespace name="${name}" version="${version}" shared-library="lib${name.toLowerCase()}.so"
        c:identifier-prefixes="${name}" c:symbol-prefixes="${name.toLowerCase()}">
        ${content}
    </namespace>
</repository>`;

describe("GirRepository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("loadFromXml", () => {
        it("loads and parses XML content", () => {
            const repo = new GirRepository();
            const xml = createMinimalGir("Test", "1.0", "");

            repo.loadFromXml(xml);
            repo.resolve();

            expect(repo.getNamespaceNames()).toContain("Test");
        });

        it("can load multiple namespaces", () => {
            const repo = new GirRepository();

            repo.loadFromXml(createMinimalGir("Gtk", "4.0", ""));
            repo.loadFromXml(createMinimalGir("GObject", "2.0", ""));
            repo.resolve();

            expect(repo.getNamespaceNames()).toContain("Gtk");
            expect(repo.getNamespaceNames()).toContain("GObject");
        });
    });

    describe("resolve", () => {
        it("throws if queried before resolve", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Test", "1.0", ""));

            expect(() => repo.getNamespaceNames()).toThrow(/resolve\(\) must be called/);
        });

        it("is idempotent", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Test", "1.0", ""));

            repo.resolve();
            repo.resolve();

            expect(repo.getNamespaceNames()).toContain("Test");
        });
    });

    describe("getNamespace", () => {
        it("returns namespace by name", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Gtk", "4.0", ""));
            repo.resolve();

            const ns = repo.getNamespace("Gtk");
            expect(ns?.name).toBe("Gtk");
            expect(ns?.version).toBe("4.0");
        });

        it("returns null for unknown namespace", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Gtk", "4.0", ""));
            repo.resolve();

            expect(repo.getNamespace("Unknown")).toBeNull();
        });
    });

    describe("resolveClass", () => {
        it("resolves class by qualified name", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gtk",
                    "4.0",
                    `<class name="Widget" c:type="GtkWidget"
                        glib:type-name="GtkWidget" glib:get-type="gtk_widget_get_type"/>`,
                ),
            );
            repo.resolve();

            const widget = repo.resolveClass("Gtk.Widget" as QualifiedName);
            expect(widget?.name).toBe("Widget");
            expect(widget?.qualifiedName).toBe("Gtk.Widget");
        });

        it("returns null for unknown class", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Gtk", "4.0", ""));
            repo.resolve();

            expect(repo.resolveClass("Gtk.Unknown" as QualifiedName)).toBeNull();
        });
    });

    describe("resolveInterface", () => {
        it("resolves interface by qualified name", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gtk",
                    "4.0",
                    `<interface name="Buildable" c:type="GtkBuildable" glib:type-name="GtkBuildable"/>`,
                ),
            );
            repo.resolve();

            const buildable = repo.resolveInterface("Gtk.Buildable" as QualifiedName);
            expect(buildable?.name).toBe("Buildable");
        });
    });

    describe("resolveRecord", () => {
        it("resolves record by qualified name", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gdk",
                    "4.0",
                    `<record name="Rectangle" c:type="GdkRectangle"
                        glib:type-name="GdkRectangle" glib:get-type="gdk_rectangle_get_type">
                        <field name="x" writable="1"><type name="gint"/></field>
                    </record>`,
                ),
            );
            repo.resolve();

            const rect = repo.resolveRecord("Gdk.Rectangle" as QualifiedName);
            expect(rect?.name).toBe("Rectangle");
        });
    });

    describe("resolveEnum", () => {
        it("resolves enumeration by qualified name", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gtk",
                    "4.0",
                    `<enumeration name="Orientation" c:type="GtkOrientation">
                        <member name="horizontal" value="0" c:identifier="GTK_ORIENTATION_HORIZONTAL"/>
                        <member name="vertical" value="1" c:identifier="GTK_ORIENTATION_VERTICAL"/>
                    </enumeration>`,
                ),
            );
            repo.resolve();

            const orientation = repo.resolveEnum("Gtk.Orientation" as QualifiedName);
            expect(orientation?.name).toBe("Orientation");
            expect(orientation?.members.length).toBe(2);
        });
    });

    describe("resolveFlags", () => {
        it("resolves bitfield by qualified name", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gdk",
                    "4.0",
                    `<bitfield name="ModifierType" c:type="GdkModifierType">
                        <member name="shift_mask" value="1" c:identifier="GDK_SHIFT_MASK"/>
                    </bitfield>`,
                ),
            );
            repo.resolve();

            const modType = repo.resolveFlags("Gdk.ModifierType" as QualifiedName);
            expect(modType?.name).toBe("ModifierType");
        });
    });

    describe("resolveCallback", () => {
        it("resolves callback by qualified name", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gio",
                    "2.0",
                    `<callback name="AsyncReadyCallback" c:type="GAsyncReadyCallback">
                        <return-value><type name="none"/></return-value>
                    </callback>`,
                ),
            );
            repo.resolve();

            const callback = repo.resolveCallback("Gio.AsyncReadyCallback" as QualifiedName);
            expect(callback?.name).toBe("AsyncReadyCallback");
        });
    });

    describe("resolveConstant", () => {
        it("resolves constant by qualified name", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gtk",
                    "4.0",
                    `<constant name="MAJOR_VERSION" value="4" c:type="GTK_MAJOR_VERSION">
                        <type name="gint"/>
                    </constant>`,
                ),
            );
            repo.resolve();

            const constant = repo.resolveConstant("Gtk.MAJOR_VERSION" as QualifiedName);
            expect(constant?.name).toBe("MAJOR_VERSION");
            expect(constant?.value).toBe("4");
        });
    });

    describe("resolveFunction", () => {
        it("resolves function by qualified name", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gtk",
                    "4.0",
                    `<function name="init" c:identifier="gtk_init">
                        <return-value><type name="none"/></return-value>
                    </function>`,
                ),
            );
            repo.resolve();

            const init = repo.resolveFunction("Gtk.init" as QualifiedName);
            expect(init?.name).toBe("init");
            expect(init?.cIdentifier).toBe("gtk_init");
        });
    });

    describe("getTypeKind", () => {
        it("returns 'class' for class types", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gtk",
                    "4.0",
                    `<class name="Widget" c:type="GtkWidget"
                        glib:type-name="GtkWidget" glib:get-type="gtk_widget_get_type"/>`,
                ),
            );
            repo.resolve();

            expect(repo.getTypeKind("Gtk.Widget" as QualifiedName)).toBe("class");
        });

        it("returns 'interface' for interface types", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gtk",
                    "4.0",
                    `<interface name="Buildable" c:type="GtkBuildable" glib:type-name="GtkBuildable"/>`,
                ),
            );
            repo.resolve();

            expect(repo.getTypeKind("Gtk.Buildable" as QualifiedName)).toBe("interface");
        });

        it("returns 'record' for record types", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Gdk", "4.0", `<record name="Rectangle" c:type="GdkRectangle"/>`));
            repo.resolve();

            expect(repo.getTypeKind("Gdk.Rectangle" as QualifiedName)).toBe("record");
        });

        it("returns 'enum' for enumeration types", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gtk",
                    "4.0",
                    `<enumeration name="Orientation" c:type="GtkOrientation">
                        <member name="horizontal" value="0" c:identifier="GTK_ORIENTATION_HORIZONTAL"/>
                    </enumeration>`,
                ),
            );
            repo.resolve();

            expect(repo.getTypeKind("Gtk.Orientation" as QualifiedName)).toBe("enum");
        });

        it("returns 'flags' for bitfield types", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gdk",
                    "4.0",
                    `<bitfield name="ModifierType" c:type="GdkModifierType">
                        <member name="shift_mask" value="1" c:identifier="GDK_SHIFT_MASK"/>
                    </bitfield>`,
                ),
            );
            repo.resolve();

            expect(repo.getTypeKind("Gdk.ModifierType" as QualifiedName)).toBe("flags");
        });

        it("returns 'callback' for callback types", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gio",
                    "2.0",
                    `<callback name="AsyncReadyCallback" c:type="GAsyncReadyCallback">
                        <return-value><type name="none"/></return-value>
                    </callback>`,
                ),
            );
            repo.resolve();

            expect(repo.getTypeKind("Gio.AsyncReadyCallback" as QualifiedName)).toBe("callback");
        });

        it("returns null for intrinsic types", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Gtk", "4.0", ""));
            repo.resolve();

            expect(repo.getTypeKind("gint" as QualifiedName)).toBeNull();
            expect(repo.getTypeKind("utf8" as QualifiedName)).toBeNull();
        });

        it("returns null for unknown types", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Gtk", "4.0", ""));
            repo.resolve();

            expect(repo.getTypeKind("Gtk.Unknown" as QualifiedName)).toBeNull();
        });
    });

    describe("isPrimitive", () => {
        it("returns true for intrinsic types", () => {
            const repo = new GirRepository();

            expect(repo.isPrimitive("gint")).toBe(true);
            expect(repo.isPrimitive("utf8")).toBe(true);
            expect(repo.isPrimitive("gboolean")).toBe(true);
        });

        it("returns false for non-primitive types", () => {
            const repo = new GirRepository();

            expect(repo.isPrimitive("GtkWidget")).toBe(false);
            expect(repo.isPrimitive("Gtk.Button")).toBe(false);
        });
    });

    describe("isGObject", () => {
        it("returns true for class with GType", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gtk",
                    "4.0",
                    `<class name="Widget" c:type="GtkWidget"
                        glib:type-name="GtkWidget" glib:get-type="gtk_widget_get_type"/>`,
                ),
            );
            repo.resolve();

            expect(repo.isGObject("Gtk.Widget" as QualifiedName)).toBe(true);
        });

        it("returns false for class without GType", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Test", "1.0", `<class name="Simple" c:type="TestSimple"/>`));
            repo.resolve();

            expect(repo.isGObject("Test.Simple" as QualifiedName)).toBe(false);
        });

        it("returns false for unknown class", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Gtk", "4.0", ""));
            repo.resolve();

            expect(repo.isGObject("Gtk.Unknown" as QualifiedName)).toBe(false);
        });
    });

    describe("isBoxed", () => {
        it("returns true for record with GType", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gdk",
                    "4.0",
                    `<record name="Rectangle" c:type="GdkRectangle"
                        glib:type-name="GdkRectangle" glib:get-type="gdk_rectangle_get_type"/>`,
                ),
            );
            repo.resolve();

            expect(repo.isBoxed("Gdk.Rectangle" as QualifiedName)).toBe(true);
        });

        it("returns false for record without GType", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Test", "1.0", `<record name="Data" c:type="TestData"/>`));
            repo.resolve();

            expect(repo.isBoxed("Test.Data" as QualifiedName)).toBe(false);
        });
    });

    describe("findClasses", () => {
        it("finds classes matching predicate", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gtk",
                    "4.0",
                    `<class name="Widget" c:type="GtkWidget" abstract="1"
                        glib:type-name="GtkWidget" glib:get-type="gtk_widget_get_type"/>
                    <class name="Button" c:type="GtkButton"
                        glib:type-name="GtkButton" glib:get-type="gtk_button_get_type"/>`,
                ),
            );
            repo.resolve();

            const abstractClasses = repo.findClasses((cls) => cls.abstract);
            expect(abstractClasses.length).toBe(1);
            expect(abstractClasses[0].name).toBe("Widget");
        });

        it("returns empty array when no matches", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Gtk", "4.0", `<class name="Button" c:type="GtkButton"/>`));
            repo.resolve();

            const matches = repo.findClasses((cls) => cls.name === "Unknown");
            expect(matches).toEqual([]);
        });
    });

    describe("findInterfaces", () => {
        it("finds interfaces matching predicate", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gtk",
                    "4.0",
                    `<interface name="Buildable" c:type="GtkBuildable" glib:type-name="GtkBuildable"/>
                    <interface name="Accessible" c:type="GtkAccessible" glib:type-name="GtkAccessible"/>`,
                ),
            );
            repo.resolve();

            const interfaces = repo.findInterfaces((iface) => iface.name.startsWith("Build"));
            expect(interfaces.length).toBe(1);
            expect(interfaces[0].name).toBe("Buildable");
        });
    });

    describe("findRecords", () => {
        it("finds records matching predicate", () => {
            const repo = new GirRepository();
            repo.loadFromXml(
                createMinimalGir(
                    "Gdk",
                    "4.0",
                    `<record name="Rectangle" c:type="GdkRectangle"
                        glib:type-name="GdkRectangle" glib:get-type="gdk_rectangle_get_type"/>
                    <record name="Point" c:type="GdkPoint"/>`,
                ),
            );
            repo.resolve();

            const boxedRecords = repo.findRecords((rec) => rec.isBoxed());
            expect(boxedRecords.length).toBe(1);
            expect(boxedRecords[0].name).toBe("Rectangle");
        });
    });

    describe("getAllNamespaces", () => {
        it("returns all namespaces as map", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Gtk", "4.0", ""));
            repo.loadFromXml(createMinimalGir("GObject", "2.0", ""));
            repo.resolve();

            const all = repo.getAllNamespaces();
            expect(all.size).toBe(2);
            expect(all.has("Gtk")).toBe(true);
            expect(all.has("GObject")).toBe(true);
        });
    });

    describe("backward compatibility", () => {
        it("getRawNamespaces returns raw data", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Gtk", "4.0", ""));

            const raw = repo.getRawNamespaces();
            expect(raw.size).toBe(1);
            expect(raw.has("Gtk")).toBe(true);
        });

        it("getRawNamespace returns single raw namespace", () => {
            const repo = new GirRepository();
            repo.loadFromXml(createMinimalGir("Gtk", "4.0", ""));

            const raw = repo.getRawNamespace("Gtk");
            expect(raw?.name).toBe("Gtk");
        });
    });
});
