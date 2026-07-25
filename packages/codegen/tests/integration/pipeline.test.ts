import { describe, expect, it } from "vitest";
import type { GirClass } from "../../src/gir/class.js";
import type { GirFunction } from "../../src/gir/function.js";
import type { Library } from "../../src/gir/library.js";
import type { GirNamespace } from "../../src/gir/namespace.js";
import type { GirParameter, GirReturnValue } from "../../src/gir/parameter.js";
import type { GirRecord } from "../../src/gir/record.js";
import type { GirType } from "../../src/gir/type.js";
import type { TypeId } from "../../src/gir/type-id.js";
import { matchAsyncFinish } from "../../src/store/gi/async.js";
import { elementPropTypeFor } from "../../src/store/react/element-prop-imports.js";
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
    it("does not bake element rules into the metadata module", () => {
        expect(reactPipeline.metadata).not.toContain("ELEMENT_PROPS");
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

describe("codegen async promisification", () => {
    const gioSource = (): string => giModules.find(({ directory }) => directory === "gio")?.source ?? "";

    it("promisifies a module-level async function against its finish sibling", () => {
        const source = gioSource();
        expect(source).toContain(
            "export function busGet(busType: BusType, cancellable?: Cancellable | null): Promise<DBusConnection> {",
        );
        expect(source).toContain("return promisify(gBusGet, busGetFinish, cancellable, busType);");
        expect(source).toContain("export function busGetFinish(res: AsyncResult): DBusConnection {");
    });

    it("promisifies a static async constructor against its static finish", () => {
        const source = gioSource();
        expect(source).toContain(
            "static new(stream: IOStream, guid: string | null, flags: DBusConnectionFlags, observer: DBusAuthObserver | null, cancellable?: Cancellable | null): Promise<DBusConnection> {",
        );
        expect(source).toContain(
            "return promisify(gDbusConnectionNew, this.newFinish.bind(this), cancellable, getHandle(stream), guid, flags, tryGetHandle(observer));",
        );
        expect(source).toContain("static newFinish(res: AsyncResult): DBusConnection {");
    });

    it("leaves a function callback-based when its finish needs more than the async result", () => {
        const gtk = giModules.find(({ directory }) => directory === "gtk");
        const source = gtk?.source ?? "";
        expect(source).toContain(
            "export function showUriFull(parent: Window | null, uri: string, timestamp: number, cancellable: Gio.Cancellable | null, callback: Gio.AsyncReadyCallback | null): void {",
        );
        expect(source).not.toContain(
            "export function showUriFull(parent: Window | null, uri: string, timestamp: number, cancellable?: Gio.Cancellable | null): Promise",
        );
    });

    it("does not promisify a synchronous method that only carries a progress callback", () => {
        const source = gioSource();
        expect(source).toContain(
            "copy(destination: File, flags: FileCopyFlags, cancellable: Cancellable | null, progressCallback: FileProgressCallback | null): boolean;",
        );
        expect(source).not.toContain(
            "copy(destination: File, flags: FileCopyFlags, cancellable?: Cancellable | null): Promise",
        );
    });

    it("does not promisify a static async op that also takes a non-async callback", () => {
        const source = gioSource();
        expect(source).toContain(
            "static new(connection: DBusConnection, flags: DBusObjectManagerClientFlags, name: string, objectPath: string, getProxyTypeFunc: DBusProxyTypeFunc | null, cancellable: Cancellable | null, callback: AsyncReadyCallback | null): void {",
        );
    });

    it("parses the glib:finish-func annotation into the function model", () => {
        const gio = [...library.namespaces.values()].find((namespace) => namespace.name === "Gio");
        const busGet = gio?.functions.find((fn) => fn.name === "bus_get");
        expect(busGet?.finishFunc).toBe("bus_get_finish");
    });

    it("pairs through the annotation when the finish name breaks the naming convention", () => {
        const gio = [...library.namespaces.values()].find((namespace) => namespace.name === "Gio");
        const methods = gio?.interfaces.find((candidate) => candidate.name === "File")?.methods ?? [];
        const asyncFn = methods.find((method) => method.name === "replace_contents_bytes_async");
        const finishFn =
            asyncFn === undefined
                ? undefined
                : matchAsyncFinish(library, { ...asyncFn, finishFunc: "replace_contents_finish" }, methods);
        expect(finishFn?.name).toBe("replace_contents_finish");
    });

    it("pairs through an annotation that holds the finish C identifier", () => {
        const gdkpixbuf = giModules.find(({ directory }) => directory === "gdkpixbuf")?.source ?? "";
        expect(gdkpixbuf).toContain(
            "static newFromStreamAtScaleAsync(stream: Gio.InputStream, width: number, height: number, preserveAspectRatio: boolean, cancellable?: Gio.Cancellable | null): Promise<Pixbuf | null>",
        );
    });

    it("promisifies an instance async method against its annotated static finish", () => {
        const gdkpixbuf = giModules.find(({ directory }) => directory === "gdkpixbuf")?.source ?? "";
        expect(gdkpixbuf).toContain(
            "saveToStreamvAsync(stream: Gio.OutputStream, type: string, optionKeys: string[] | null, optionValues: string[] | null, cancellable?: Gio.Cancellable | null): Promise<boolean>",
        );
        expect(gdkpixbuf).toContain("Pixbuf.saveToStreamFinish.bind(Pixbuf)");
    });

    it("promisifies an instance async method against its name-matched static finish", () => {
        const source = gioSource();
        expect(source).toContain(
            "spliceAsync(stream2: IOStream, flags: IOStreamSpliceFlags, ioPriority: number, cancellable?: Cancellable | null): Promise<boolean>",
        );
    });
});

describe("codegen notify detail signals", () => {
    it("keys each introduced property's notify detail off GObject.Object's notify member", () => {
        const gobject = giModules.find(({ directory }) => directory === "gobject");
        const source = gobject?.source ?? "";
        expect(source).toContain('"notify::source-property": ObjectSignals["notify"];');
        expect(source).toContain('"notify::source-property": ObjectSignalEmit["notify"];');
    });

    it("qualifies the notify member reference across namespaces", () => {
        const gtk = giModules.find(({ directory }) => directory === "gtk");
        const source = gtk?.source ?? "";
        expect(source).toContain('"notify::visible": GObject.ObjectSignals["notify"];');
        expect(source).toContain('"notify::visible": GObject.ObjectSignalEmit["notify"];');
    });

    it("inherits a property's notify detail through the parent map rather than re-listing it", () => {
        const gtk = giModules.find(({ directory }) => directory === "gtk");
        const source = gtk?.source ?? "";
        const buttonSignals = source.slice(source.indexOf("export interface ButtonSignals"));
        const buttonBody = buttonSignals.slice(0, buttonSignals.indexOf("}"));
        expect(buttonBody).not.toContain('"notify::visible"');
    });

    it("gives a class that introduces properties but no signals its own typed overloads", () => {
        const gobject = giModules.find(({ directory }) => directory === "gobject");
        const source = gobject?.source ?? "";
        expect(source).toContain("export interface Binding {");
        expect(source).toContain("connect<K extends keyof BindingSignals>");
        expect(source).toContain("emit<K extends keyof BindingSignalEmit>");
    });
});

describe("codegen property maps", () => {
    const moduleSource = (directory: string): string =>
        giModules.find((module) => module.directory === directory)?.source ?? "";

    it("maps each introduced property to its accessor type and chains the parent map", () => {
        const source = moduleSource("gtk");
        expect(source).toContain("export interface ButtonProperties extends WidgetProperties {");
        expect(source).toContain("label: string;");
        expect(source).toContain("__properties__: ButtonProperties;");
    });

    it("qualifies the parent map across namespaces", () => {
        const source = moduleSource("gtk");
        expect(source).toContain("export interface WidgetProperties extends GObject.InitiallyUnownedProperties {");
    });

    it("carries interface properties typed against the interface that declares them", () => {
        const source = moduleSource("gtk");
        const properties = source.slice(source.indexOf("export interface ButtonProperties"));
        const body = properties.slice(0, properties.indexOf("}"));
        expect(body).toContain("actionTarget: GLib.Variant | null;");
        expect(body).not.toContain("visible: boolean;");
    });

    it("omits write-only properties", () => {
        const source = moduleSource("gtk");
        const properties = source.slice(source.indexOf("export interface CheckButtonProperties"));
        const body = properties.slice(0, properties.indexOf("}"));
        expect(body).toContain("active: boolean;");
        expect(body).not.toContain("group:");
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
            'export const GtkNotebookPage: (props: GtkNotebookPageElementProps) => ReactNode = createElementComponent("GtkNotebookPage");',
        );
        expect(gtk).toContain('createElementComponent("GtkStackPage")');
    });
});

describe("codegen configurable element components", () => {
    const overridden = sourceFor(
        generateJsxFiles(library, [], { GtkButton: { module: "@example/wrappers", export: "withButton" } }),
        "gtk",
    );

    it("wraps a plain element with the user's component and imports it", () => {
        expect(overridden).toContain('import { withButton } from "@example/wrappers";');
        expect(overridden).toContain(
            'export const GtkButton: (props: GtkButtonProps) => ReactNode = withButton(createElementComponent("GtkButton"));',
        );
    });

    it("fans the wrapper out to subclasses by ancestry", () => {
        expect(overridden).toContain('withButton(createElementComponent("GtkToggleButton"))');
    });

    it("leaves elements outside the ancestry unwrapped", () => {
        expect(overridden).toContain(
            'export const GtkLabel: (props: GtkLabelProps) => ReactNode = createElementComponent("GtkLabel");',
        );
    });

    it("keeps a built-in wrapper the override does not cover", () => {
        expect(overridden).toContain('createWindowComponent(createElementComponent("GtkWindow"))');
    });

    it("lets a user override win over a built-in on the same ancestry", () => {
        const gtk = sourceFor(
            generateJsxFiles(library, [], { GtkWindow: { module: "@example/wrappers", export: "withWindow" } }),
            "gtk",
        );
        expect(gtk).toContain('withWindow(createElementComponent("GtkWindow"))');
        expect(gtk).not.toContain('createWindowComponent(createElementComponent("GtkWindow"))');
    });

    it("leaves elements unwrapped without any override", () => {
        expect(sourceFor(reactPipeline, "gtk")).toContain(
            'export const GtkButton: (props: GtkButtonProps) => ReactNode = createElementComponent("GtkButton");',
        );
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

    it("extends the hand-declared props interface on a container-prop host", () => {
        const adw = sourceFor(reactPipeline, "adw");
        expect(adw).toMatch(
            /import \{[^}]*type GtkHeaderBarProps as GtkHeaderBarPropsBase[^}]*\} from "@gtkx\/react";/,
        );
        expect(adw).toMatch(/export interface AdwHeaderBarProps<[^>]*> extends GtkHeaderBarPropsBase,/);
    });

    it("extends the hand-declared props interface on GtkWidget", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(gtk).toMatch(/import \{[^}]*type GtkWidgetProps as GtkWidgetPropsBase[^}]*\} from "@gtkx\/react";/);
        expect(gtk).toMatch(/export interface GtkWidgetProps<[^>]*> extends GtkWidgetPropsBase,/);
    });
});

const interfaceBody = (jsxSource: string, glibName: string): string => {
    const block = jsxSource.slice(jsxSource.indexOf(`export interface ${glibName}Props`));
    return block.slice(0, block.indexOf("\n}"));
};

describe("codegen applied element props", () => {
    it("extends the hand-declared props interface for a value prop host", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(gtk).toMatch(/export interface GtkDropTargetProps<[^>]*> extends GtkDropTargetPropsBase,/);
    });

    it("extends the hand-declared placement props on the child element's interface", () => {
        const gio = sourceFor(reactPipeline, "gio");
        expect(gio).toMatch(
            /import \{[^}]*type GActionGroupProps as GActionGroupPropsBase[^}]*\} from "@gtkx\/react";/,
        );
        expect(gio).toMatch(/export interface GActionGroupProps<[^>]*> extends GActionGroupPropsBase/);
    });

    it("emits lazy-element props from the page class interface", () => {
        const gtk = sourceFor(reactPipeline, "gtk");
        expect(gtk).toContain(
            'export type GtkStackPageElementProps = Omit<GtkStackPageProps, "child"> & { children?: ReactNode };',
        );
        expect(gtk).toMatch(/export type GtkNotebookPageElementProps = Omit<GtkNotebookPageProps, [^;]*>[^;]*;/);
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

const defaultPropsBody = (metadata: string, glibName: string): string => {
    const table = metadata.slice(metadata.indexOf("export const DEFAULT_PROPS"));
    const block = table.slice(table.indexOf(`"${glibName}": {`));
    return block.slice(0, block.indexOf("\n    }"));
};

describe("codegen runtime tables", () => {
    it("omits a null default when the property setter rejects null", () => {
        const button = defaultPropsBody(reactPipeline.metadata, "GtkButton");
        expect(button).not.toContain('"iconName"');
        expect(button).not.toContain('"label"');
    });

    it("keeps a null default when the property setter accepts null", () => {
        expect(defaultPropsBody(reactPipeline.metadata, "GtkImage")).toContain('"iconName": null');
        expect(defaultPropsBody(reactPipeline.metadata, "GtkButton")).toContain('"actionName": null');
    });

    it("keeps non-null defaults on properties whose setter rejects null", () => {
        expect(defaultPropsBody(reactPipeline.metadata, "GtkButton")).toContain('"hasFrame": true');
    });

    it("extends named-slot elements from the hand-declared @gtkx/react types", () => {
        const adw = sourceFor(reactPipeline, "adw");
        expect(adw).toMatch(/export interface AdwHeaderBarProps<[^>]*> extends [^{]*GtkHeaderBarPropsBase/);
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

const hasContainerProps = (glibName: string | undefined): boolean =>
    glibName !== undefined && elementPropTypeFor(glibName) !== undefined;

const interfacePropsNames = (): Set<string> => {
    const names = new Set<string>();
    for (const widget of collectIntrinsicElementClasses(library)) {
        for (const iface of implementedInterfaces(widget.klass, widget.namespace, library)) {
            if (!interfaceHasPropsBody(iface.klass, hasContainerProps)) continue;
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
