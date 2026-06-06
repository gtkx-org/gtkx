import { describe, expect, it } from "vitest";
import { generateNamespaceModule } from "../../src/ffi/pipeline.js";
import { loadGirRepository } from "../../src/gir/repository.js";
import { generateReactFiles } from "../../src/react/pipeline.js";
import { transpileSource } from "../../src/transpile.js";

const GIR_PATH = ["/usr/share/gir-1.0"];

const repository = loadGirRepository(["Gtk-4.0", "Adw-1"], GIR_PATH);

const ffiModules = [...repository.namespaces.values()].map((namespace) =>
    generateNamespaceModule(namespace, repository),
);

const reactPipeline = generateReactFiles(repository);

describe("codegen FFI pipeline", () => {
    it("resolves the transitive dependency closure of Gtk and Adw", () => {
        const names = [...repository.namespaces.keys()];
        expect(names).toEqual(expect.arrayContaining(["GLib", "GObject", "Gio", "Gdk", "Gsk", "Gtk", "Adw"]));
    });

    it("emits one module per namespace at the expected path", () => {
        for (const { path } of ffiModules) {
            expect(path).toMatch(/^[a-z0-9]+\/[a-z0-9]+\.ts$/);
        }
        expect(ffiModules.length).toBe(repository.namespaces.size);
    });

    it("produces non-empty source with imports and exports for every namespace", () => {
        for (const { source } of ffiModules) {
            expect(source.length).toBeGreaterThan(0);
            expect(source).toContain("export");
        }
    });

    it("emits a registered GTK Button class binding", () => {
        const gtk = ffiModules.find(({ path }) => path === "gtk/gtk.ts");
        expect(gtk).toBeDefined();
        expect(gtk?.source).toContain("Button");
    });

    it("transpiles a generated FFI module to valid JS and declarations", () => {
        const gtk = ffiModules.find(({ path }) => path === "gtk/gtk.ts");
        expect(gtk).toBeDefined();
        const { js, dts } = transpileSource(gtk?.path ?? "", gtk?.source ?? "");
        expect(js.length).toBeGreaterThan(0);
        expect(dts.length).toBeGreaterThan(0);
        expect(js).not.toContain("interface ");
    }, 60000);
});

describe("codegen return-value convention", () => {
    it("folds an out-array length companion out of the return tuple", () => {
        const gio = ffiModules.find(({ path }) => path === "gio/gio.ts");
        const source = gio?.source ?? "";
        expect(source).toContain("loadContents(cancellable: Cancellable | null): [boolean, number[], string]");
        expect(source).not.toContain("[boolean, number[], number, string]");
    });

    it("returns a bare array when the only surfaced out is an array with a folded length", () => {
        const pango = ffiModules.find(({ path }) => path === "pango/pango.ts");
        const source = pango?.source ?? "";
        expect(source).toContain("listFamilies(): FontFamily[]");
        expect(source).not.toContain("listFamilies(): [FontFamily[], number]");
    });

    it("keeps an unlinked length out-parameter in the return tuple", () => {
        const glib = ffiModules.find(({ path }) => path === "glib/glib.ts");
        const source = glib?.source ?? "";
        expect(source).toContain("getGroups(): [string[], number]");
    });

    it("drops a skip-annotated return value from the surfaced result", () => {
        const glib = ffiModules.find(({ path }) => path === "glib/glib.ts");
        const source = glib?.source ?? "";
        expect(source).toContain(
            "uriSplit(uriRef: string, flags: UriFlags): [string, string, string, number, string, string, string]",
        );
        expect(source).not.toContain("[boolean, string, string, string, number, string, string, string]");
    });
});

describe("codegen notify detail signals", () => {
    it("keys each introduced property's notify detail off GObject.Object's notify member", () => {
        const gobject = ffiModules.find(({ path }) => path === "gobject/gobject.ts");
        const source = gobject?.source ?? "";
        expect(source).toContain('"notify::source-property": ObjectSignalHandlers["notify"];');
        expect(source).toContain('"notify::source-property": ObjectSignalEmit["notify"];');
    });

    it("qualifies the notify member reference across namespaces", () => {
        const gtk = ffiModules.find(({ path }) => path === "gtk/gtk.ts");
        const source = gtk?.source ?? "";
        expect(source).toContain('"notify::visible": GObject.ObjectSignalHandlers["notify"];');
        expect(source).toContain('"notify::visible": GObject.ObjectSignalEmit["notify"];');
    });

    it("inherits a property's notify detail through the parent map rather than re-listing it", () => {
        const gtk = ffiModules.find(({ path }) => path === "gtk/gtk.ts");
        const source = gtk?.source ?? "";
        const buttonHandlers = source.slice(source.indexOf("export interface ButtonSignalHandlers"));
        const buttonBody = buttonHandlers.slice(0, buttonHandlers.indexOf("}"));
        expect(buttonBody).not.toContain('"notify::visible"');
    });

    it("gives a class that introduces properties but no signals its own typed overloads", () => {
        const gobject = ffiModules.find(({ path }) => path === "gobject/gobject.ts");
        const source = gobject?.source ?? "";
        expect(source).toContain("export interface Binding {");
        expect(source).toContain("connect<K extends keyof BindingSignalHandlers>");
        expect(source).toContain("emit<K extends keyof BindingSignalEmit>");
    });
});

describe("codegen React pipeline", () => {
    it("emits the jsx, compounds, and internal files", () => {
        const paths = [...reactPipeline.files.keys()].sort((a, b) => a.localeCompare(b));
        expect(paths.length).toBe(3);
        for (const source of reactPipeline.files.values()) {
            expect(source.length).toBeGreaterThan(0);
        }
    });

    it("counts the widget intrinsics it emitted", () => {
        expect(reactPipeline.widgetCount).toBeGreaterThan(0);
    });

    it("transpiles every generated React file", () => {
        for (const [path, source] of reactPipeline.files) {
            const { js, dts } = transpileSource(path, source);
            expect(js.length).toBeGreaterThan(0);
            expect(dts.length).toBeGreaterThan(0);
        }
    });

    it("honours user-supplied widget-slot overrides", () => {
        const overridden = generateReactFiles(repository, { widgetSlots: { GtkButton: ["child"] } });
        const compoundsSource = overridden.files.get("compounds.tsx") ?? "";
        expect(compoundsSource).toContain('id="child"');
        const { js } = transpileSource("compounds.tsx", compoundsSource);
        expect(js.length).toBeGreaterThan(0);
    });

    it("promotes a user-supplied container slot on a widget without built-in ones", () => {
        const overridden = generateReactFiles(repository, { containerSlots: { GtkButton: ["addChild"] } });
        const jsxSource = overridden.files.get("jsx.ts") ?? "";
        const compoundsSource = overridden.files.get("compounds.tsx") ?? "";
        expect(jsxSource).toContain("addChild?: ReactNode | null;");
        expect(compoundsSource).toContain('id="addChild"');
        const { js } = transpileSource("compounds.tsx", compoundsSource);
        expect(js.length).toBeGreaterThan(0);
    });

    it("ignores a user container slot on a non-ReactNode class", () => {
        const overridden = generateReactFiles(repository, { containerSlots: { GApplication: ["addWindow"] } });
        const compoundsSource = overridden.files.get("compounds.tsx") ?? "";
        expect(compoundsSource).not.toContain("GApplicationProps");
        for (const [path, source] of overridden.files) {
            const { js, dts } = transpileSource(path, source);
            expect(js.length).toBeGreaterThan(0);
            expect(dts.length).toBeGreaterThan(0);
        }
    });
});

describe("repository lookups", () => {
    it("resolves a known cross-namespace type", () => {
        expect(repository.resolveNamed("GLib", "Variant")).toBeDefined();
    });

    it("returns undefined for an unknown type", () => {
        expect(repository.resolveNamed("GLib", "NoSuchType")).toBeUndefined();
        expect(repository.resolveNamed("NoSuchNamespace", "Thing")).toBeUndefined();
    });
});
