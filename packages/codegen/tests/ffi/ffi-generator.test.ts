import type { GirNamespace, GirRepository } from "@gtkx/gir";
import { describe, expect, it } from "vitest";
import { FfiGenerator } from "../../src/ffi/ffi-generator.js";
import {
    createButtonClass,
    createNormalizedClass,
    createNormalizedConstant,
    createNormalizedEnumeration,
    createNormalizedField,
    createNormalizedFunction,
    createNormalizedInterface,
    createNormalizedMethod,
    createNormalizedNamespace,
    createNormalizedRecord,
    createNormalizedType,
    createWidgetClass,
} from "../fixtures/gir-fixtures.js";
import { createMockRepository } from "../fixtures/mock-repository.js";

const baseNamespaces = (overrides: Partial<Record<string, GirNamespace>> = {}): Map<string, GirNamespace> => {
    const map = new Map<string, GirNamespace>();
    map.set("GLib", createNormalizedNamespace({ name: "GLib", sharedLibrary: "libglib-2.0.so.0" }));
    map.set("GObject", createNormalizedNamespace({ name: "GObject", sharedLibrary: "libgobject-2.0.so.0" }));
    for (const [name, ns] of Object.entries(overrides)) {
        if (ns) map.set(name, ns);
    }
    return map;
};

const filePathOf = (files: Array<{ path: string }>, suffix: string): string | undefined =>
    files.find((f) => f.path.endsWith(suffix))?.path;

describe("FfiGenerator constructor", () => {
    it("constructs with the supplied repository and namespace", () => {
        const repo = createMockRepository(baseNamespaces());
        const generator = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        });
        expect(generator).toBeInstanceOf(FfiGenerator);
    });
});

describe("FfiGenerator.generateNamespace", () => {
    it("throws when the target namespace is missing from the repository", () => {
        const repo = createMockRepository(baseNamespaces());
        const generator = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        });
        expect(() => generator.generateNamespace("Gtk")).toThrow(/not found/);
    });

    it("throws when GLib has no shared library configured", () => {
        const namespaces = new Map<string, GirNamespace>();
        namespaces.set(
            "GLib",
            createNormalizedNamespace({ name: "GLib", sharedLibrary: undefined as unknown as string }),
        );
        namespaces.set("GObject", createNormalizedNamespace({ name: "GObject" }));
        namespaces.set("Gtk", createNormalizedNamespace({ name: "Gtk" }));
        const repo = createMockRepository(namespaces);

        const generator = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        });

        expect(() => generator.generateNamespace("Gtk")).toThrow(/No shared library/);
    });

    it("throws when the namespace shared library string starts with a leading comma", () => {
        const namespaces = baseNamespaces();
        namespaces.set("GLib", createNormalizedNamespace({ name: "GLib", sharedLibrary: ",libglib-2.0.so.0" }));
        namespaces.set("Gtk", createNormalizedNamespace({ name: "Gtk" }));
        const repo = createMockRepository(namespaces);

        const generator = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        });

        expect(() => generator.generateNamespace("Gtk")).toThrow(/Invalid shared library/);
    });

    it("emits an enums file when the namespace declares enumerations", () => {
        const enumeration = createNormalizedEnumeration({ qualifiedName: "Gtk.Orientation" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            enumerations: new Map([[enumeration.name, enumeration]]),
        });
        const repo = createMockRepository(baseNamespaces({ Gtk: ns }));

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        }).generateNamespace("Gtk");

        expect(filePathOf(files, "/enums.ts")).toBe("gtk/enums.ts");
    });

    it("merges bitfields with enumerations into a single enums file", () => {
        const enumeration = createNormalizedEnumeration({ qualifiedName: "Gtk.Orientation" });
        const flags = createNormalizedEnumeration({
            qualifiedName: "Gtk.DebugFlags",
            name: "DebugFlags",
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            enumerations: new Map([[enumeration.name, enumeration]]),
            bitfields: new Map([[flags.name, flags]]),
        });
        const repo = createMockRepository(baseNamespaces({ Gtk: ns }));

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        }).generateNamespace("Gtk");

        expect(files.filter((f) => f.path.endsWith("/enums.ts"))).toHaveLength(1);
    });

    it("emits a functions file only when the namespace has standalone functions", () => {
        const ns = createNormalizedNamespace({
            name: "Gtk",
            functions: new Map([["init", createNormalizedFunction({ name: "init" })]]),
        });
        const repo = createMockRepository(baseNamespaces({ Gtk: ns }));

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        }).generateNamespace("Gtk");

        expect(filePathOf(files, "/functions.ts")).toBe("gtk/functions.ts");
    });

    it("emits a constants file when the namespace declares constants", () => {
        const ns = createNormalizedNamespace({
            name: "Gtk",
            constants: new Map([["MAJOR_VERSION", createNormalizedConstant({ qualifiedName: "Gtk.MAJOR_VERSION" })]]),
        });
        const repo = createMockRepository(baseNamespaces({ Gtk: ns }));

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        }).generateNamespace("Gtk");

        expect(filePathOf(files, "/constants.ts")).toBe("gtk/constants.ts");
    });

    it("always emits an index.ts that re-exports every other generated file", () => {
        const enumeration = createNormalizedEnumeration({ qualifiedName: "Gtk.Orientation" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            enumerations: new Map([[enumeration.name, enumeration]]),
        });
        const repo = createMockRepository(baseNamespaces({ Gtk: ns }));

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        }).generateNamespace("Gtk");

        const index = files.find((f) => f.path === "gtk/index.ts");
        expect(index).toBeDefined();
        expect(index?.content).toContain('export * from "./enums.js";');
    });

    it("returns an empty index when the namespace produced only the index file", () => {
        const ns = createNormalizedNamespace({ name: "Gtk" });
        const repo = createMockRepository(baseNamespaces({ Gtk: ns }));

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        }).generateNamespace("Gtk");

        const index = files.find((f) => f.path === "gtk/index.ts");
        expect(index?.content).toBe("");
    });

    it("emits a per-class file for each class in topologically sorted order", () => {
        const widget = createWidgetClass();
        const button = createButtonClass();
        const ns = createNormalizedNamespace({
            name: "Gtk",
            classes: new Map([
                [button.name, button],
                [widget.name, widget],
            ]),
        });
        const repo = createMockRepository(baseNamespaces({ Gtk: ns }));

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        }).generateNamespace("Gtk");

        const classPaths = files.map((f) => f.path).filter((p) => p.endsWith("widget.ts") || p.endsWith("button.ts"));
        expect(classPaths).toContain("gtk/widget.ts");
        expect(classPaths).toContain("gtk/button.ts");
    });

    it("emits an interface file using the kebab-cased interface name", () => {
        const orientable = createNormalizedInterface({ name: "Orientable" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            interfaces: new Map([[orientable.name, orientable]]),
        });
        const repo = createMockRepository(baseNamespaces({ Gtk: ns }));

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        }).generateNamespace("Gtk");

        expect(filePathOf(files, "orientable.ts")).toBe("gtk/orientable.ts");
    });

    it("skips records whose name ends with the Private suffix", () => {
        const privateRec = createNormalizedRecord({ name: "WidgetPrivate" });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([[privateRec.name, privateRec]]),
        });
        const repo = createMockRepository(baseNamespaces({ Gtk: ns }));

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        }).generateNamespace("Gtk");

        expect(files.find((f) => f.path.includes("widget-private"))).toBeUndefined();
    });

    it("emits a stub for opaque records when they carry a glib type name", () => {
        const opaqueRecord = createNormalizedRecord({
            name: "Bytes",
            qualifiedName: "GLib.Bytes",
            opaque: true,
            glibTypeName: "GBytes",
            glibGetType: "g_bytes_get_type",
        });
        const ns = createNormalizedNamespace({
            name: "GLib",
            sharedLibrary: "libglib-2.0.so.0",
            records: new Map([[opaqueRecord.name, opaqueRecord]]),
        });
        const repo = createMockRepository(
            baseNamespaces({
                GLib: ns,
                Gtk: createNormalizedNamespace({ name: "Gtk" }),
            }),
        );

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "GLib",
        }).generateNamespace("GLib");

        expect(filePathOf(files, "bytes.ts")).toBe("glib/bytes.ts");
    });

    it("walks nested record fields when deciding whether to fully generate a record", () => {
        const inner = createNormalizedRecord({
            name: "Inner",
            qualifiedName: "Gtk.Inner",
            cType: "GtkInner",
            fields: [createNormalizedField({ name: "value", type: createNormalizedType({ name: "gint" }) })],
        });
        const outer = createNormalizedRecord({
            name: "Outer",
            qualifiedName: "Gtk.Outer",
            cType: "GtkOuter",
            fields: [createNormalizedField({ name: "inner", type: createNormalizedType({ name: "Inner" }) })],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([
                [outer.name, outer],
                [inner.name, inner],
            ]),
        });
        const repo = createMockRepository(baseNamespaces({ Gtk: ns }));

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        }).generateNamespace("Gtk");

        expect(filePathOf(files, "outer.ts")).toBe("gtk/outer.ts");
        expect(filePathOf(files, "inner.ts")).toBe("gtk/inner.ts");
    });

    it("falls back to a stub for records whose fields recurse to a disguised type", () => {
        const inner = createNormalizedRecord({
            name: "Inner",
            qualifiedName: "Gtk.Inner",
            cType: "GtkInner",
            disguised: true,
        });
        const outer = createNormalizedRecord({
            name: "Outer",
            qualifiedName: "Gtk.Outer",
            cType: "GtkOuter",
            fields: [createNormalizedField({ name: "inner", type: createNormalizedType({ name: "Inner" }) })],
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            records: new Map([
                [outer.name, outer],
                [inner.name, inner],
            ]),
        });
        const repo = createMockRepository(baseNamespaces({ Gtk: ns }));

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        }).generateNamespace("Gtk");

        const outerFile = files.find((f) => f.path === "gtk/outer.ts");
        expect(outerFile?.content).toContain("Stub class for Outer");
    });

    it("emits stub methods on a glib-typed opaque record that exposes safe instance methods", () => {
        const opaqueRecord = createNormalizedRecord({
            name: "Bytes",
            qualifiedName: "GLib.Bytes",
            opaque: true,
            glibTypeName: "GBytes",
            glibGetType: "g_bytes_get_type",
            cType: "GBytes",
            methods: [
                createNormalizedMethod({
                    name: "get_size",
                    cIdentifier: "g_bytes_get_size",
                    returnType: createNormalizedType({ name: "gsize" }),
                }),
            ],
        });
        const ns = createNormalizedNamespace({
            name: "GLib",
            sharedLibrary: "libglib-2.0.so.0",
            records: new Map([[opaqueRecord.name, opaqueRecord]]),
        });
        const repo = createMockRepository(
            baseNamespaces({
                GLib: ns,
                Gtk: createNormalizedNamespace({ name: "Gtk" }),
            }),
        );

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "GLib",
        }).generateNamespace("GLib");

        const bytesFile = files.find((f) => f.path === "glib/bytes.ts");
        expect(bytesFile?.content).toContain("getSize");
    });

    it("generates records that have only primitive fields", () => {
        const record = createNormalizedRecord({
            name: "Rectangle",
            qualifiedName: "Gdk.Rectangle",
            fields: [
                createNormalizedField({ name: "x", type: createNormalizedType({ name: "gint" }) }),
                createNormalizedField({ name: "y", type: createNormalizedType({ name: "gint" }) }),
                createNormalizedField({ name: "width", type: createNormalizedType({ name: "gint" }) }),
                createNormalizedField({ name: "height", type: createNormalizedType({ name: "gint" }) }),
            ],
        });
        const ns = createNormalizedNamespace({
            name: "Gdk",
            sharedLibrary: "libgdk-4.so.1",
            records: new Map([[record.name, record]]),
        });
        const repo = createMockRepository(
            baseNamespaces({
                Gdk: ns,
            }),
        );

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gdk",
        }).generateNamespace("Gdk");

        expect(filePathOf(files, "rectangle.ts")).toBe("gdk/rectangle.ts");
    });

    it("includes well-known core type-class records as stubs", () => {
        const typeClass = createNormalizedRecord({
            name: "TypeClass",
            qualifiedName: "GObject.TypeClass",
            opaque: true,
        });
        const ns = createNormalizedNamespace({
            name: "GObject",
            sharedLibrary: "libgobject-2.0.so.0",
            records: new Map([[typeClass.name, typeClass]]),
        });
        const repo = createMockRepository(
            baseNamespaces({
                GObject: ns,
            }),
        );

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "GObject",
        }).generateNamespace("GObject");

        expect(filePathOf(files, "type-class.ts")).toBe("gobject/type-class.ts");
    });

    it("topologically sorts classes so a parent file precedes its children", () => {
        const widget = createWidgetClass();
        const button = createButtonClass();
        const grandchild = createNormalizedClass({
            name: "Toggle",
            qualifiedName: "Gtk.Toggle",
            cType: "GtkToggle",
            parent: "Gtk.Button",
            glibTypeName: "GtkToggle",
            glibGetType: "gtk_toggle_get_type",
        });
        const ns = createNormalizedNamespace({
            name: "Gtk",
            classes: new Map([
                [grandchild.name, grandchild],
                [button.name, button],
                [widget.name, widget],
            ]),
        });
        const repo = createMockRepository(baseNamespaces({ Gtk: ns }));

        const { files } = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        }).generateNamespace("Gtk");

        const paths = files.map((f) => f.path);
        const widgetIdx = paths.indexOf("gtk/widget.ts");
        const buttonIdx = paths.indexOf("gtk/button.ts");
        const toggleIdx = paths.indexOf("gtk/toggle.ts");
        expect(widgetIdx).toBeGreaterThanOrEqual(0);
        expect(buttonIdx).toBeGreaterThan(widgetIdx);
        expect(toggleIdx).toBeGreaterThan(buttonIdx);
    });

    it("produces the same file list across repeat invocations on the same generator", () => {
        const widget = createWidgetClass();
        const ns = createNormalizedNamespace({
            name: "Gtk",
            classes: new Map([[widget.name, widget]]),
        });
        const repo = createMockRepository(baseNamespaces({ Gtk: ns }));

        const generator = new FfiGenerator({
            repository: repo as unknown as GirRepository,
            namespace: "Gtk",
        });
        const first = generator
            .generateNamespace("Gtk")
            .files.map((f) => f.path)
            .sort();
        const second = generator
            .generateNamespace("Gtk")
            .files.map((f) => f.path)
            .sort();

        expect(second).toEqual(first);
    });
});
