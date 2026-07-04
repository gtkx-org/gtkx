import { describe, expect, it } from "vitest";
import { generateJsxFiles } from "../../src/store/react/pipeline.js";
import { transpileSource } from "../../src/transpile.js";
import { giModules, library } from "../helpers/library.js";

const reactPipeline = generateJsxFiles(library);
const sourceFor = (files: typeof reactPipeline, directory: string): string =>
    files.namespaces.find((entry) => entry.directory === directory)?.source ?? "";

describe("codegen gi pipeline", () => {
    it("resolves the transitive dependency closure of Gtk and Adw", () => {
        const names = [...library.namespaces.keys()];
        expect(names).toEqual(expect.arrayContaining(["GLib", "GObject", "Gio", "Gdk", "Gsk", "Gtk", "Adw"]));
    });

    it("emits one module per namespace under the expected directory", () => {
        for (const { directory } of giModules) {
            expect(directory).toMatch(/^[a-z0-9]+$/);
        }
        expect(giModules.length).toBe(library.namespaces.size);
    });

    it("produces non-empty source with imports and exports for every namespace", () => {
        for (const { source } of giModules) {
            expect(source.length).toBeGreaterThan(0);
            expect(source).toContain("export");
        }
    });

    it("emits a registered GTK Button class binding", () => {
        const gtk = giModules.find(({ directory }) => directory === "gtk");
        expect(gtk).toBeDefined();
        expect(gtk?.source).toContain("Button");
    });

    it("transpiles a generated gi module to valid JS and declarations", () => {
        const gtk = giModules.find(({ directory }) => directory === "gtk");
        expect(gtk).toBeDefined();
        const { js, dts } = transpileSource(`${gtk?.directory ?? ""}.ts`, gtk?.source ?? "");
        expect(js.length).toBeGreaterThan(0);
        expect(dts.length).toBeGreaterThan(0);
        expect(js).not.toContain("interface ");
    }, 60000);
});

describe("codegen reconciler metadata", () => {
    it("emits the serializable relationship and synthetic-prop tables", () => {
        expect(reactPipeline.metadata).toContain("export const RELATIONSHIPS:");
        expect(reactPipeline.metadata).toContain("export const SYNTHETIC_PROPS:");
        expect(reactPipeline.metadata).toContain('"element": "GtkStackPage"');
        expect(reactPipeline.metadata).toContain('"prop": "marks"');
    });
});

describe("codegen return-value convention", () => {
    it("folds an out-array length companion out of the return tuple", () => {
        const gio = giModules.find(({ directory }) => directory === "gio");
        const source = gio?.source ?? "";
        expect(source).toContain("loadContents(cancellable: Cancellable | null): [boolean, number[], string]");
        expect(source).not.toContain("[boolean, number[], number, string]");
    });

    it("returns a bare array when the only surfaced out is an array with a folded length", () => {
        const pango = giModules.find(({ directory }) => directory === "pango");
        const source = pango?.source ?? "";
        expect(source).toContain("listFamilies(): FontFamily[]");
        expect(source).not.toContain("listFamilies(): [FontFamily[], number]");
    });

    it("keeps an unlinked length out-parameter in the return tuple", () => {
        const glib = giModules.find(({ directory }) => directory === "glib");
        const source = glib?.source ?? "";
        expect(source).toContain("getGroups(): [string[], number]");
    });

    it("drops a skip-annotated return value from the surfaced result", () => {
        const glib = giModules.find(({ directory }) => directory === "glib");
        const source = glib?.source ?? "";
        expect(source).toContain(
            "uriSplit(uriRef: string, flags: UriFlags): [string, string, string, number, string, string, string]",
        );
        expect(source).not.toContain("[boolean, string, string, string, number, string, string, string]");
    });
});

describe("codegen notify detail signals", () => {
    it("keys each introduced property's notify detail off GObject.Object's notify member", () => {
        const gobject = giModules.find(({ directory }) => directory === "gobject");
        const source = gobject?.source ?? "";
        expect(source).toContain('"notify::source-property": ObjectSignalHandlers["notify"];');
        expect(source).toContain('"notify::source-property": ObjectSignalEmit["notify"];');
    });

    it("qualifies the notify member reference across namespaces", () => {
        const gtk = giModules.find(({ directory }) => directory === "gtk");
        const source = gtk?.source ?? "";
        expect(source).toContain('"notify::visible": GObject.ObjectSignalHandlers["notify"];');
        expect(source).toContain('"notify::visible": GObject.ObjectSignalEmit["notify"];');
    });

    it("inherits a property's notify detail through the parent map rather than re-listing it", () => {
        const gtk = giModules.find(({ directory }) => directory === "gtk");
        const source = gtk?.source ?? "";
        const buttonHandlers = source.slice(source.indexOf("export interface ButtonSignalHandlers"));
        const buttonBody = buttonHandlers.slice(0, buttonHandlers.indexOf("}"));
        expect(buttonBody).not.toContain('"notify::visible"');
    });

    it("gives a class that introduces properties but no signals its own typed overloads", () => {
        const gobject = giModules.find(({ directory }) => directory === "gobject");
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
        expect(adw).toMatch(/import \{[^}]*type GtkWidgetProps[^}]*\} from "@gtkx\/jsx\/gtk";/);
    });

    it("counts the widget intrinsics it emitted", () => {
        expect(reactPipeline.intrinsicElementCount).toBeGreaterThan(0);
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

    it("emits companion elements as relationship components", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(gtk).toContain(
            'export const GtkNotebookPage: (props: NotebookPageProps) => ReactNode = withNotebookTabLabel(createRelationshipComponent<NotebookPageProps>("GtkNotebookPage"));',
        );
        expect(gtk).toContain(
            'export const GtkFixedChild: (props: FixedChildProps) => ReactNode = withFixedTransform(createRelationshipComponent<FixedChildProps>("GtkFixedChild"));',
        );
        expect(gtk).toContain('createRelationshipComponent<StackPageProps>("GtkStackPage")');
        expect(gtk).not.toContain("GtkNotebookPageTab");
    });
});

describe("codegen React pipeline (auto-derived slots)", () => {
    it("widens a settable GObject-class property into a ReactElement slot", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(interfaceBody(gtk, "GtkWindow")).toContain("titlebar?: Gtk.Widget | ReactElement | null | undefined;");
    });

    it("widens a text view's buffer into a ReactElement slot", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(interfaceBody(gtk, "GtkTextView")).toContain(
            "buffer?: Gtk.TextBuffer | ReactElement | null | undefined;",
        );
    });

    it("keeps the single-child `child` property a plain widget reference, not a slot", () => {
        const body = interfaceBody(sourceFor(reactPipeline, "gtk"), "GtkButton");
        expect(body).toContain("child?: Gtk.Widget | null | undefined;");
        expect(body).not.toContain("child?: Gtk.Widget | ReactElement");
    });

    it("emits no runtime slot table", () => {
        expect(reactPipeline.metadata).not.toContain("export const SLOTS");
    });

    it("types the built-in container-slot props as ReactNode on their host", () => {
        const adw = sourceFor(reactPipeline, "adw");
        const headerBar = interfaceBody(adw, "AdwHeaderBar");
        expect(headerBar).toContain("start?: ReactNode | null | undefined;");
        expect(headerBar).toContain("end?: ReactNode | null | undefined;");
    });

    it("types the base GtkWidget controller and action-group slots as ReactNode", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(gtk).toContain("controllers?: ReactNode | null | undefined;");
        expect(gtk).toContain("actionGroups?: ReactNode | null | undefined;");
    });
});

const interfaceBody = (jsxSource: string, glibName: string): string => {
    const block = jsxSource.slice(jsxSource.indexOf(`export interface ${glibName}Props`));
    return block.slice(0, block.indexOf("\n}"));
};

describe("codegen synthetic props", () => {
    it("composes the runtime-owned synthetic props onto every element component and imports the helper", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(gtk).toMatch(/createElementComponent<GtkScaleProps & SyntheticPropsFor<"GtkScale"[^>]*>>\("GtkScale"\)/);
        expect(gtk).toMatch(
            /createElementComponent<GtkButtonProps & SyntheticPropsFor<"GtkButton"[^>]*>>\("GtkButton"\)/,
        );
        expect(gtk).toMatch(/import \{[^}]*type SyntheticPropsFor[^}]*\} from "@gtkx\/react";/);
    });

    it("unions a subclass with its ancestors so inherited synthetic props resolve", () => {
        const adw = sourceFor(reactPipeline, "adw");
        expect(adw).toMatch(/AdwApplicationProps & SyntheticPropsFor<"AdwApplication" \| "GtkApplication"/);
    });

    it("keeps the generated props interface and intrinsic-element map free of synthetic props", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(interfaceBody(gtk, "GtkScale")).not.toContain("marks?:");
        expect(gtk).toContain("GtkScale: GtkScaleProps;");
        const { dts } = transpileSource("gtk/gtk.tsx", gtk);
        expect(dts).not.toContain("TS2717");
    });
});

describe("codegen read-only props", () => {
    it("omits the settable line for a read-only property but keeps its notify handler", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        const widgetBody = interfaceBody(gtk, "GtkWidget");
        expect(widgetBody).not.toContain("parent?: Gtk.Widget | null;");
        expect(widgetBody).toContain("onNotifyParent?:");
    });

    it("keeps the settable line for a writable property", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        const widgetBody = interfaceBody(gtk, "GtkWidget");
        expect(widgetBody).toContain("opacity?: number | null | undefined;");
        expect(widgetBody).toContain("onNotifyOpacity?:");
    });
});

describe("codegen runtime tables", () => {
    it("bakes the genuine GIR capability tables into the metadata module", () => {
        expect(reactPipeline.metadata).toContain("export const TOPLEVEL_TYPES");
        expect(reactPipeline.metadata).toContain("export const DEFAULT_BLOCKABLE_TYPES");
        expect(reactPipeline.metadata).toContain("export const META_OBJECT_ADD_METHODS");
        expect(reactPipeline.metadata).toContain("export const PAGE_META_SETTERS");
        expect(reactPipeline.metadata).toContain("export const ATTACH_SHAPES");
        expect(reactPipeline.metadata).toContain("export const ORDERED_INSERT");
        expect(reactPipeline.metadata).toContain("export const SLOT_PROPS");
    });

    it("no longer bakes the deleted serialized rule tables", () => {
        expect(reactPipeline.metadata).not.toContain("export const ELEMENT_MAP");
        expect(reactPipeline.metadata).not.toContain("export const LIST_PROP_RULES");
        expect(reactPipeline.metadata).not.toContain("export const PROP_RULES");
        expect(reactPipeline.metadata).not.toContain("export const CHILD_ATTACH_RULES");
    });

    it("bakes the ColumnView ordered-insert capability", () => {
        expect(reactPipeline.metadata).toMatch(/"GtkColumnView":\s*\{\s*"collection": "getColumns"/);
    });

    it("bakes the per-host slot prop names", () => {
        expect(reactPipeline.metadata).toMatch(/"AdwHeaderBar":\s*\[\s*"start",\s*"end"\s*\]/);
    });
});

describe("repository lookups", () => {
    it("resolves a known cross-namespace type", () => {
        expect(library.resolveType("GLib", "Variant")).toBeDefined();
    });

    it("returns undefined for an unknown type", () => {
        expect(library.resolveType("GLib", "NoSuchType")).toBeUndefined();
        expect(library.resolveType("NoSuchNamespace", "Thing")).toBeUndefined();
    });

    it("leaves only non-introspectable C types unresolved across the closure", () => {
        const unresolved = library.collectUnresolved();
        const unexpected = unresolved.filter((name) => {
            const local = name.slice(name.indexOf(".") + 1);
            return local !== "va_list" && local !== "";
        });
        expect(unexpected).toEqual([]);
    });
});
