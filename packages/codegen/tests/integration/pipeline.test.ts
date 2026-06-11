import { describe, expect, it } from "vitest";
import { generateJsxFiles } from "../../src/react/pipeline.js";
import { transpileSource } from "../../src/transpile.js";
import { ffiModules, repository } from "../helpers/repository.js";

const reactPipeline = generateJsxFiles(repository);
const sourceFor = (files: typeof reactPipeline, directory: string): string =>
    files.namespaces.find((entry) => entry.directory === directory)?.source ?? "";

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
    it("emits a module per namespace plus the merged metadata", () => {
        expect(reactPipeline.namespaces.length).toBeGreaterThan(0);
        for (const { source } of reactPipeline.namespaces) {
            expect(source.length).toBeGreaterThan(0);
        }
        expect(reactPipeline.metadata).toContain("export const SIGNALS");
        expect(reactPipeline.metadata).toContain("export const CONSTRUCT_ONLY_PROPS");
        expect(reactPipeline.metadata).toContain("export const DEFAULT_PROPS");
    });

    it("loads its own namespace as a side effect and never another", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(gtk).toContain('import "@gtkx/gi/gtk";');
        expect(gtk).not.toContain('import "@gtkx/gi/adw";');
    });

    it("imports a cross-namespace parent Props type from its jsx module", () => {
        const adw = sourceFor(reactPipeline, "adw");
        expect(adw).toMatch(/import type \{[^}]*\} from "@gtkx\/jsx\/gtk";/);
    });

    it("counts the widget intrinsics it emitted", () => {
        expect(reactPipeline.widgetCount).toBeGreaterThan(0);
    });

    it("transpiles every generated React module and the metadata", () => {
        for (const { directory, source } of reactPipeline.namespaces) {
            const { js, dts } = transpileSource(`${directory}/${directory}.tsx`, source);
            expect(js.length).toBeGreaterThan(0);
            expect(dts.length).toBeGreaterThan(0);
        }
        const { js } = transpileSource("metadata.ts", reactPipeline.metadata);
        expect(js.length).toBeGreaterThan(0);
    });

    it("desugars a virtual subcomponent's slot into a positional wrapper child", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(gtk).toContain("export const GtkNotebookPage");
        expect(gtk).toContain('kind="tab-label"');
        expect(gtk).toContain("tabLabel");
        expect(gtk).not.toContain("GtkNotebookPageTab");
    });
});

describe("codegen React pipeline (slot overrides)", () => {
    it("honours user-supplied widget-slot overrides", () => {
        const overridden = generateJsxFiles(repository, { slots: { GtkButton: ["child"] } });
        const gtk = sourceFor(overridden, "gtk");
        expect(interfaceBody(gtk, "GtkButton")).toContain("child?: ReactNode | null;");
        expect(overridden.metadata).toMatch(/"GtkButton": \[\s*"child"\s*\]/);
        const { js } = transpileSource("gtk/gtk.tsx", gtk);
        expect(js.length).toBeGreaterThan(0);
    });

    it("promotes a user-supplied container slot on a widget without built-in ones", () => {
        const overridden = generateJsxFiles(repository, { containerSlots: { GtkButton: ["addChild"] } });
        const gtk = sourceFor(overridden, "gtk");
        expect(gtk).toContain("addChild?: ReactNode | null;");
        expect(overridden.metadata).toMatch(/"GtkButton": \[\s*"addChild"\s*\]/);
        const { js } = transpileSource("gtk/gtk.tsx", gtk);
        expect(js.length).toBeGreaterThan(0);
    });

    it("promotes a user container slot on a plain GObject class", () => {
        const overridden = generateJsxFiles(repository, { containerSlots: { GApplication: ["addWindow"] } });
        const gio = sourceFor(overridden, "gio");
        expect(gio).toContain("GApplicationProps");
        expect(gio).toContain("addWindow?: ReactNode | null;");
        expect(overridden.metadata).toMatch(/"GApplication": \[\s*"addWindow"\s*\]/);
        const { js, dts } = transpileSource("gio/gio.tsx", gio);
        expect(js.length).toBeGreaterThan(0);
        expect(dts.length).toBeGreaterThan(0);
    });
});

const interfaceBody = (jsxSource: string, glibName: string): string => {
    const block = jsxSource.slice(jsxSource.indexOf(`export interface ${glibName}Props`));
    return block.slice(0, block.indexOf("\n}"));
};

describe("codegen array props", () => {
    it("emits the built-in array-prop line and item-type import on its element", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(interfaceBody(gtk, "GtkScale")).toContain("marks?: ScaleMark[] | null;");
        expect(gtk).toMatch(/import type \{[^}]*\} from "@gtkx\/react";/);
        expect(gtk).toContain("ScaleMark");
        const adw = sourceFor(reactPipeline, "adw");
        expect(adw).toContain("ToggleProps");
    });

    it("suppresses the raw GObject property of an array-prop name", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        const dropTargetBody = interfaceBody(gtk, "GtkDropTarget");
        expect(dropTargetBody).toContain("types?: DropTargetType[] | null;");
        expect(dropTargetBody).not.toContain("types?: GType[] | null;");
        expect(dropTargetBody).not.toContain("onNotifyTypes");
        const { dts } = transpileSource("gtk/gtk.tsx", gtk);
        expect(dts).not.toContain("TS2717");
    });

    it("merges a user arrayProps entry with the built-ins, emitting its line and import", () => {
        const overridden = generateJsxFiles(repository, {
            arrayProps: { GtkScale: { marks: { itemType: "ScaleMark", clear: "clearMarks" } } },
        });
        const gtk = sourceFor(overridden, "gtk");
        expect(interfaceBody(gtk, "GtkScale")).toContain("marks?: ScaleMark[] | null;");
        expect(interfaceBody(gtk, "GtkCalendar")).toContain("markedDays?: CalendarMark[] | null;");
        expect(gtk).toContain('from "@gtkx/react";');
        expect(gtk).toContain("ScaleMark");
        const { dts } = transpileSource("gtk/gtk.tsx", gtk);
        expect(dts.length).toBeGreaterThan(0);
    });
});

describe("codegen runtime tables", () => {
    it("bakes the reconciler tables into the metadata module", () => {
        expect(reactPipeline.metadata).toContain("export const ELEMENT_MAP");
        expect(reactPipeline.metadata).toContain('"child": "GtkEventController"');
        expect(reactPipeline.metadata).toContain("export const ARRAY_PROPS");
        expect(reactPipeline.metadata).toContain("export const PROP_RULES");
        expect(reactPipeline.metadata).toContain("export const TOP_LEVEL_TYPES");
        expect(reactPipeline.metadata).toContain("export const META_OBJECT_ADD_METHODS");
        expect(reactPipeline.metadata).toContain("export const PAGE_META_SETTERS");
        expect(reactPipeline.metadata).toContain("export const SLOTS");
        expect(reactPipeline.metadata).toContain("export const CONTAINER_SLOTS");
    });

    it("appends user elementMap rows after the built-ins", () => {
        const overridden = generateJsxFiles(repository, {
            elementMap: [
                {
                    child: "MyAppGadget",
                    parentType: "MyAppBoard",
                    verb: {
                        kind: "method",
                        attach: "add",
                        attachArgs: "child",
                        detach: "remove",
                        detachArgs: "child",
                    },
                },
            ],
        });
        expect(overridden.metadata).toContain('"child": "MyAppGadget"');
        expect(overridden.metadata.indexOf('"child": "GtkEventController"')).toBeLessThan(
            overridden.metadata.indexOf('"child": "MyAppGadget"'),
        );
    });

    it("bakes merged user array-prop rows into the metadata module", () => {
        const overridden = generateJsxFiles(repository, {
            arrayProps: { GtkScale: { marks: { itemType: "ScaleMark", clear: "clearAllMarks" } } },
        });
        expect(overridden.metadata).toContain('"clear": "clearAllMarks"');
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
