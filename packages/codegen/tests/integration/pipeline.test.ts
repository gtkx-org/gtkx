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
