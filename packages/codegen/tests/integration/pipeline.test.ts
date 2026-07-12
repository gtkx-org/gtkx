import { describe, expect, it } from "vitest";
import type { GirClass } from "../../src/gir/class.js";
import type { GirFunction } from "../../src/gir/function.js";
import type { Library } from "../../src/gir/library.js";
import type { GirNamespace } from "../../src/gir/namespace.js";
import type { GirParameter, GirReturnValue } from "../../src/gir/parameter.js";
import type { GirRecord } from "../../src/gir/record.js";
import type { GirType } from "../../src/gir/type.js";
import type { TypeId } from "../../src/gir/type-id.js";
import {
    collectIntrinsicElementClasses,
    glibNameOf,
    implementedInterfaces,
    interfaceHasPropsBody,
} from "../../src/store/react/intrinsic-elements.js";
import { generateJsxFiles } from "../../src/store/react/pipeline.js";
import { giModules, library } from "../helpers/library.js";

type WalkedCallable = { parameters: GirParameter[]; returnValue: GirReturnValue };

const createUnresolvedWalker = (target: Library) => {
    const seen = new Set<string>();
    const unresolved = new Set<string>();
    const visit = (ref: TypeId | undefined): void => {
        if (ref === undefined) return;
        const key = `${ref.nsId}:${ref.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        const type = target.typeOf(ref);
        if (type === undefined) {
            recordUnresolved(ref);
            return;
        }
        visitContainedRefs(type);
    };
    const recordUnresolved = (ref: TypeId): void => {
        const name = target.nameOf(ref);
        if (name !== undefined) unresolved.add(`${name.namespaceName}.${name.typeName}`);
    };
    const visitContainedRefs = (type: GirType): void => {
        if (type.kind === "carray" || type.kind === "list") visit(type.element);
        if (type.kind === "hashtable") {
            visit(type.key);
            visit(type.value);
        }
        if (type.kind === "callback") visitCallable(type.value);
    };
    const visitCallable = (callable: WalkedCallable): void => {
        for (const parameter of callable.parameters) visit(parameter.type);
        visit(callable.returnValue.type);
    };
    const visitFunction = (fn: GirFunction): void => {
        if (fn.instance !== undefined) visit(fn.instance.type);
        visitCallable(fn);
    };
    const visitClass = (klass: GirClass): void => {
        for (const fn of [...klass.methods, ...klass.constructors, ...klass.functions]) visitFunction(fn);
        for (const property of klass.properties) visit(property.type);
        for (const signal of klass.signals) visitCallable(signal);
    };
    const visitRecord = (record: GirRecord): void => {
        for (const fn of [...record.methods, ...record.constructors, ...record.functions]) visitFunction(fn);
        for (const field of record.fields) visit(field.type);
    };
    const visitNamespace = (namespace: GirNamespace): void => {
        for (const klass of [...namespace.classes, ...namespace.interfaces]) visitClass(klass);
        for (const record of namespace.records) visitRecord(record);
        for (const callback of namespace.callbacks) visitCallable(callback);
        for (const fn of namespace.functions) visitFunction(fn);
        for (const constant of namespace.constants) visit(constant.type);
        for (const alias of namespace.aliases) visit(alias.target);
    };
    return { visitNamespace, unresolved };
};

const collectUnresolvedTypeNames = (target: Library): string[] => {
    const walker = createUnresolvedWalker(target);
    for (const namespace of target.namespaces.values()) walker.visitNamespace(namespace);
    return [...walker.unresolved];
};

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
});

describe("codegen element-prop metadata", () => {
    it("emits the serializable element-prop table", () => {
        expect(reactPipeline.metadata).toContain("export const ELEMENT_PROPS:");
        expect(reactPipeline.metadata).toContain('"adopt": true');
        expect(reactPipeline.metadata).toContain('"kind": "lazy"');
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

describe("codegen GObject item comparators", () => {
    const moduleSource = (directory: string): string =>
        giModules.find((module) => module.directory === directory)?.source ?? "";

    const itemComparatorSignature = "(a: GObject.Object | null, b: GObject.Object | null)";
    const itemComparatorArgs = 't.callback([t.object("borrowed"), t.object("borrowed"), t.uint64], t.int32';
    const itemEqualityArgs = 't.callback([t.object("borrowed"), t.object("borrowed")], t.boolean';
    const itemEqualityFullArgs = 't.callback([t.object("borrowed"), t.object("borrowed"), t.uint64], t.boolean';

    it("types ListStore comparator callbacks over borrowed object items", () => {
        const source = moduleSource("gio");
        expect(source).toContain(`sort(compareFunc: ${itemComparatorSignature} => number): void`);
        expect(source).toContain(
            `insertSorted(item: GObject.Object, compareFunc: ${itemComparatorSignature} => number): number`,
        );
        expect(source).toContain(
            `findWithEqualFunc(item: GObject.Object | null, equalFunc: ${itemComparatorSignature} => boolean): [boolean, number]`,
        );
        expect(source).toContain(
            `findWithEqualFuncFull(item: GObject.Object | null, equalFunc: ${itemComparatorSignature} => boolean): [boolean, number]`,
        );
        expect(source).toContain(`${itemComparatorArgs}, { userDataIndex: 2, scope: "call" })`);
        expect(source).toContain(`${itemEqualityArgs}, { scope: "call" })`);
        expect(source).toContain(`${itemEqualityFullArgs}, { userDataIndex: 2, scope: "call" })`);
    });

    it("types CustomSorter comparator callbacks over borrowed object items", () => {
        const source = moduleSource("gtk");
        expect(source).toContain(`static new(sortFunc: (${itemComparatorSignature} => number) | null): CustomSorter`);
        expect(source).toContain(`setSortFunc(sortFunc: (${itemComparatorSignature} => number) | null): void`);
        expect(source).toContain(`${itemComparatorArgs}, { hasDestroy: true, userDataIndex: 2, scope: "notified" })`);
    });

    it("keeps raw-pointer comparator callbacks outside GObject item containers", () => {
        const source = moduleSource("glib");
        expect(source).toContain("export type CompareDataFunc = (a: number | null, b: number | null) => number;");
        expect(source).toContain("export type EqualFunc = (a: number | null, b: number | null) => boolean;");
        expect(source).not.toContain(itemComparatorSignature);
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

    it("emits page elements as lazy-element components", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(gtk).toContain(
            "export const GtkNotebookPage: (props: GtkNotebookPageElementProps) => ReactNode = createLazyElementComponent<GtkNotebookPageElementProps>();",
        );
        expect(gtk).toContain("createLazyElementComponent<GtkStackPageElementProps>()");
    });
});

describe("codegen widget-slot props", () => {
    it("widens a settable GObject-class property into a ReactElement slot", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(interfaceBody(gtk, "GtkWindow")).toContain("titlebar?: Gtk$.Widget | ReactElement | null | undefined;");
    });

    it("widens a text view's buffer into a ReactElement slot", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(interfaceBody(gtk, "GtkTextView")).toContain(
            "buffer?: Gtk$.TextBuffer | ReactElement | null | undefined;",
        );
    });

    it("keeps the single-child `child` property a plain widget reference, not a slot", () => {
        const body = interfaceBody(sourceFor(reactPipeline, "gtk"), "GtkButton");
        expect(body).toContain("child?: Gtk$.Widget | null | undefined;");
        expect(body).not.toContain("child?: Gtk$.Widget | ReactElement");
    });

    it("types the built-in container-prop props as ReactNode on their host", () => {
        const adw = sourceFor(reactPipeline, "adw");
        const headerBar = interfaceBody(adw, "AdwHeaderBar");
        expect(headerBar).toContain("start?: ReactNode | null | undefined;");
        expect(headerBar).toContain("end?: ReactNode | null | undefined;");
    });

    it("types the base GtkWidget controller and action-group props as ReactNode", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(gtk).toContain("controllers?: ReactNode | null | undefined;");
        expect(gtk).toContain("actionGroups?: ReactNode | null | undefined;");
    });
});

const interfaceBody = (jsxSource: string, glibName: string): string => {
    const block = jsxSource.slice(jsxSource.indexOf(`export interface ${glibName}Props`));
    return block.slice(0, block.indexOf("\n}"));
};

describe("codegen applied element props", () => {
    it("types a value prop from its setter signature", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(interfaceBody(gtk, "GtkDropTarget")).toContain("types?: GObject$.Type[] | null | undefined;");
    });

    it("contributes container-prop arguments to the child element's props", () => {
        const gio = sourceFor(reactPipeline, "gio");
        expect(interfaceBody(gio, "GSimpleActionGroup")).toContain("prefix?: string | null | undefined;");
    });

    it("emits lazy-element props from the page class interface", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(gtk).toContain('export type GtkStackPageElementProps = Omit<GtkStackPageProps, "child">;');
        expect(gtk).toMatch(/export type GtkNotebookPageElementProps = Omit<GtkNotebookPageProps, [^;]*>;/);
        expect(interfaceBody(gtk, "GtkNotebookPage")).toContain("tabLabel?: string | null | undefined;");
    });
});

describe("codegen read-only props", () => {
    it("omits the settable line for a read-only property but keeps its notify handler", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        const widgetBody = interfaceBody(gtk, "GtkWidget");
        expect(widgetBody).not.toContain("parent?: Gtk$.Widget | null;");
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
    it("bakes the element-prop table into the metadata module", () => {
        expect(reactPipeline.metadata).toContain("export const ELEMENT_PROPS");
    });

    it("bakes the ColumnView ordered insert as a container prop", () => {
        expect(reactPipeline.metadata).toMatch(/"method": "insertColumn"/);
        expect(reactPipeline.metadata).toMatch(/"GtkColumnView": \[/);
    });

    it("bakes named-slot container props", () => {
        expect(reactPipeline.metadata).toMatch(/"AdwHeaderBar": \[[\s\S]{0,160}"prop": "start"/);
    });
});

describe("Library.resolveType", () => {
    it("resolves a known cross-namespace type", () => {
        expect(library.resolveType("GLib", "Variant")).toBeDefined();
    });

    it("returns undefined for an unknown type", () => {
        expect(library.resolveType("GLib", "NoSuchType")).toBeUndefined();
        expect(library.resolveType("NoSuchNamespace", "Thing")).toBeUndefined();
    });

    it("leaves only non-introspectable C types unresolved across the closure", () => {
        const unresolved = collectUnresolvedTypeNames(library);
        const unexpected = unresolved.filter((name) => {
            const local = name.slice(name.indexOf(".") + 1);
            return local !== "va_list" && local !== "";
        });
        expect(unexpected).toEqual([]);
    });
});

const jsxSources = (): string[] => generateJsxFiles(library).namespaces.map((entry) => entry.source);

const interfacePropsNames = (): Set<string> => {
    const names = new Set<string>();
    for (const widget of collectIntrinsicElementClasses(library)) {
        for (const iface of implementedInterfaces(widget.klass, widget.namespace, library)) {
            if (!interfaceHasPropsBody(iface.klass)) continue;
            const glib = glibNameOf(iface.klass);
            if (glib !== undefined) names.add(`${glib}Props`);
        }
    }
    return names;
};

const matchAll = (sources: string[], pattern: RegExp): string[] =>
    sources.flatMap((source) => [...source.matchAll(pattern)].map((match) => match[1] ?? ""));

const stripDocComments = (source: string): string => source.replace(/\/\*\*[\s\S]*?\*\//g, "");

const moduleSource = (directory: string): string => {
    const found = giModules.find((entry) => entry.directory === directory);
    expect(found, `expected generated module for ${directory}`).toBeDefined();
    return stripDocComments(found?.source ?? "");
};

describe("identifier naming convention", () => {
    it("exports aliases under their GIR name, never the C-prefixed c:type", () => {
        const glib = moduleSource("glib");
        expect(glib).toMatch(/export type Quark\b/);
        expect(glib).toMatch(/export type Pid\b/);
        expect(glib).not.toMatch(/\bGQuark\b/);
        expect(glib).not.toMatch(/\bGPid\b/);
    });

    it("publishes the GObject Type alias under its GIR name", () => {
        const gobject = moduleSource("gobject");
        expect(gobject).toMatch(/export type Type\b/);
        expect(gobject).not.toMatch(/export type GType\b/);
    });

    it("emits a named type for every top-level callback, under its GIR name", () => {
        const glib = moduleSource("glib");
        expect(glib).toContain("export type SourceFunc =");
        expect(glib).toContain("export type CompareFunc =");
    });

    it("exports the shadowed short name for a shadowing namespace function", () => {
        const glib = moduleSource("glib");
        expect(glib).toMatch(/\bidleAdd\b/);
        expect(glib).not.toMatch(/\bidleAddFull\b/);
    });

    it("emits record, union, and enum identifiers verbatim from the GIR name", () => {
        const harfbuzz = moduleSource("harfbuzz");
        expect(harfbuzz).toMatch(/export class font_t\b/);
        expect(harfbuzz).toMatch(/export enum memory_mode_t\b/);
        expect(harfbuzz).not.toMatch(/export class FontT\b/);
        expect(harfbuzz).not.toMatch(/export enum MemoryModeT\b/);
    });
});

describe("jsx prop-interface naming convention", () => {
    it("names every exported props interface after an element or implemented interface glib name", () => {
        const sources = jsxSources();
        const declaredProps = matchAll(sources, /export interface (\w+Props)\b/g);
        const elementGlibNames = matchAll(sources, /^\s*(\w+): \w+Props;$/gm);
        const allowed = new Set([...elementGlibNames.map((name) => `${name}Props`), ...interfacePropsNames()]);

        const offenders = declaredProps.filter((name) => !allowed.has(name));
        expect(offenders, `unexpected props interface names: ${offenders.join(", ")}`).toEqual([]);
    });
});
