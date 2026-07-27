import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { GirClass } from "../../src/gir/class.js";
import type { GirFunction } from "../../src/gir/function.js";
import type { Library } from "../../src/gir/library.js";
import type { GirNamespace } from "../../src/gir/namespace.js";
import type { GirParameter, GirReturnValue } from "../../src/gir/parameter.js";
import type { GirRecord } from "../../src/gir/record.js";
import type { TypeId } from "../../src/gir/type-id.js";
import type { GirType } from "../../src/gir/type.js";
import { readBuiltinElements } from "../../src/react/element-config.js";
import { matchAsyncFinish } from "../../src/store/gi/async.js";
import { elementPropTypeFor } from "../../src/store/jsx/element-prop-imports.js";
import {
    collectIntrinsicElementClasses,
    getGlibName,
    type GlibNamedClass,
    hasInterfacePropsBody,
    implementedInterfaces,
    type ResolvedQualifiedInterface,
} from "../../src/store/jsx/intrinsic-elements.js";
import { generateJsxFiles } from "../../src/store/jsx/pipeline.js";
import { giModules, library } from "../helpers/library.js";

type WalkedCallable = { parameters: GirParameter[]; returnValue: GirReturnValue };
type UnresolvedWalker = { target: Library; seen: Set<string>; unresolved: Set<string> };

const GI_STORE_DIR = fileURLToPath(new URL("../../../../node_modules/.gtkx/gi", import.meta.url));
const REACT_SUBEXPORTS = ["config", "adw", "adw/config", "internal"];
/** The @gtkx/react element config, read from the linked package the same way codegen threads it into the pipeline. */
const REACT_SURFACE = await readBuiltinElements(REACT_SUBEXPORTS, GI_STORE_DIR);
const reactPipeline = generateJsxFiles(library, REACT_SURFACE);

const BUS_GET_SIGNATURE =
    "export function busGet(busType: BusType, cancellable?: Cancellable | null): Promise<DBusConnection> {";

const BUS_GET_PROMISIFY_CALL = "return promisify(gBusGet, busGetFinish, cancellable, busType);";

const DBUS_CONNECTION_NEW_SIGNATURE =
    "static new(stream: IOStream, guid: string | null, flags: DBusConnectionFlags, " +
    "observer: DBusAuthObserver | null, cancellable?: Cancellable | null): Promise<DBusConnection> {";

const DBUS_CONNECTION_NEW_PROMISIFY_CALL =
    "return promisify(gDbusConnectionNew, this.newFinish.bind(this), cancellable, " +
    "getHandle(stream), guid, flags, tryGetHandle(observer));";

const SHOW_URI_FULL_CALLBACK_SIGNATURE =
    "export function showUriFull(parent: Window | null, uri: string, timestamp: number, " +
    "cancellable: Gio.Cancellable | null, callback: Gio.AsyncReadyCallback | null): void {";

const SHOW_URI_FULL_PROMISE_SIGNATURE =
    "export function showUriFull(parent: Window | null, uri: string, timestamp: number, " +
    "cancellable?: Gio.Cancellable | null): Promise";

const FILE_COPY_SIGNATURE =
    "copy(destination: File, flags: FileCopyFlags, cancellable: Cancellable | null, " +
    "progressCallback: FileProgressCallback | null): boolean;";

const FILE_COPY_PROMISE_SIGNATURE =
    "copy(destination: File, flags: FileCopyFlags, cancellable?: Cancellable | null): Promise";

const DBUS_OBJECT_MANAGER_CLIENT_NEW_SIGNATURE =
    "static new(connection: DBusConnection, flags: DBusObjectManagerClientFlags, name: string, " +
    "objectPath: string, getProxyTypeFunc: DBusProxyTypeFunc | null, cancellable: Cancellable | null, " +
    "callback: AsyncReadyCallback | null): void {";

const PIXBUF_NEW_FROM_STREAM_AT_SCALE_SIGNATURE =
    "static newFromStreamAtScaleAsync(stream: Gio.InputStream, width: number, height: number, " +
    "preserveAspectRatio: boolean, cancellable?: Gio.Cancellable | null): Promise<Pixbuf | null>";

const PIXBUF_SAVE_TO_STREAMV_SIGNATURE =
    "saveToStreamvAsync(stream: Gio.OutputStream, type: string, optionKeys: string[] | null, " +
    "optionValues: string[] | null, cancellable?: Gio.Cancellable | null): Promise<boolean>";

const IO_STREAM_SPLICE_SIGNATURE =
    "spliceAsync(stream2: IOStream, flags: IOStreamSpliceFlags, ioPriority: number, " +
    "cancellable?: Cancellable | null): Promise<boolean>";

const visitEach = <T>(items: Iterable<T>, visitor: (item: T) => void): void => {
    for (const item of items) {
        visitor(item);
    }
};

const recordUnresolved = (walker: UnresolvedWalker, ref: TypeId): void => {
    const name = walker.target.nameFor(ref);

    if (name !== undefined) {
        walker.unresolved.add(`${name.namespaceName}.${name.typeName}`);
    }
};

const visitTypeRef = (walker: UnresolvedWalker, ref: TypeId | undefined): void => {
    if (ref === undefined) {
        return;
    }

    const key = `${String(ref.nsId)}:${String(ref.id)}`;

    if (walker.seen.has(key)) {
        return;
    }

    walker.seen.add(key);
    const type = walker.target.typeFor(ref);

    if (type === undefined) {
        recordUnresolved(walker, ref);

        return;
    }

    visitContainedRefs(walker, type);
};

const visitContainedRefs = (walker: UnresolvedWalker, type: GirType): void => {
    switch (type.kind) {
        case "carray":
        case "list": {
            visitTypeRef(walker, type.element);
            break;
        }
        case "hashtable": {
            visitTypeRef(walker, type.key);
            visitTypeRef(walker, type.value);
            break;
        }
        case "callback": {
            visitCallable(walker, type.value);
            break;
        }
        case "alias":
        case "class":
        case "enum":
        case "interface":
        case "primitive":
        case "record":
        case "varargs": {
            break;
        }
    }
};

const visitCallable = (walker: UnresolvedWalker, callable: WalkedCallable): void => {
    for (const parameter of callable.parameters) {
        visitTypeRef(walker, parameter.type);
    }

    visitTypeRef(walker, callable.returnValue.type);
};

const visitFunction = (walker: UnresolvedWalker, fn: GirFunction): void => {
    if (fn.instance !== undefined) {
        visitTypeRef(walker, fn.instance.type);
    }

    visitCallable(walker, fn);
};

const visitClass = (walker: UnresolvedWalker, klass: GirClass): void => {
    for (const fn of [...klass.methods, ...klass.constructors, ...klass.functions]) {
        visitFunction(walker, fn);
    }

    for (const property of klass.properties) {
        visitTypeRef(walker, property.type);
    }

    for (const signal of klass.signals) {
        visitCallable(walker, signal);
    }
};

const visitRecord = (walker: UnresolvedWalker, record: GirRecord): void => {
    for (const fn of [...record.methods, ...record.constructors, ...record.functions]) {
        visitFunction(walker, fn);
    }

    for (const field of record.fields) {
        visitTypeRef(walker, field.type);
    }
};

const visitNamespace = (walker: UnresolvedWalker, namespace: GirNamespace): void => {
    visitEach([...namespace.classes, ...namespace.interfaces], (klass) => {
        visitClass(walker, klass);
    });

    visitEach(namespace.records, (record) => {
        visitRecord(walker, record);
    });

    visitEach(namespace.callbacks, (callable) => {
        visitCallable(walker, callable);
    });

    visitEach(namespace.functions, (fn) => {
        visitFunction(walker, fn);
    });

    visitEach(namespace.constants, (constant) => {
        visitTypeRef(walker, constant.type);
    });

    visitEach(namespace.aliases, (alias) => {
        visitTypeRef(walker, alias.target);
    });
};

const collectUnresolvedTypeNames = (target: Library): string[] => {
    const walker: UnresolvedWalker = { target, seen: new Set<string>(), unresolved: new Set<string>() };

    for (const namespace of target.namespaces.values()) {
        visitNamespace(walker, namespace);
    }

    return [...walker.unresolved];
};

const getSource = (files: typeof reactPipeline, directory: string): string =>
    files.namespaces.find((entry) => entry.directory === directory)?.source ?? "";

const giSource = (directory: string): string =>
    giModules.find((module) => module.directory === directory)?.source ?? "";

const namespaceNamed = (name: string): GirNamespace | undefined =>
    library.namespaces.values().find((namespace) => namespace.name === name);

const gioSource = (): string => giSource("gio");

const interfaceBody = (jsxSource: string, glibName: string): string => {
    const block = jsxSource.slice(jsxSource.indexOf(`export interface ${glibName}Props`));

    return block.slice(0, block.indexOf("\n}"));
};

const defaultPropsBody = (metadata: string, glibName: string): string => {
    const table = metadata.slice(metadata.indexOf("export const DEFAULT_PROPS"));
    const block = table.slice(table.indexOf(`"${glibName}": {`));

    return block.slice(0, block.indexOf("\n    }"));
};

const jsxSources = (): string[] => generateJsxFiles(library, REACT_SURFACE).namespaces.map((entry) => entry.source);

const hasContainerProps = (glibName: string | undefined): boolean =>
    glibName !== undefined && elementPropTypeFor(glibName) !== undefined;

const getInterfacePropsName = (iface: ResolvedQualifiedInterface): string | undefined => {
    if (!hasInterfacePropsBody(iface.klass, hasContainerProps)) {
        return undefined;
    }

    const glib = getGlibName(iface.klass);

    return glib === undefined ? undefined : `${glib}Props`;
};

const addInterfacePropsNames = (widget: GlibNamedClass, names: Set<string>): void => {
    for (const iface of implementedInterfaces(widget.klass, widget.namespace, library)) {
        const name = getInterfacePropsName(iface);

        if (name !== undefined) {
            names.add(name);
        }
    }
};

// An abstract GType is not an element -- `g_object_new` on one aborts -- but its props interface has
// to stay, because every concrete subclass extends it.
const abstractPropsNames = (): Set<string> => {
    const names: Set<string> = new Set();

    for (const entry of collectIntrinsicElementClasses(library)) {
        if (entry.klass.isAbstract) {
            names.add(`${entry.glibName}Props`);
        }
    }

    return names;
};

const interfacePropsNames = (): Set<string> => {
    const names: Set<string> = new Set();

    for (const widget of collectIntrinsicElementClasses(library)) {
        addInterfacePropsNames(widget, names);
    }

    return names;
};

const matchAll = (sources: string[], pattern: RegExp): string[] =>
    sources.flatMap((source) =>
        source
            .matchAll(pattern)
            .map((match) => match[1] ?? "")
            .toArray(),
    );

const stripDocComments = (source: string): string => source.replaceAll(/\/\*\*[\s\S]*?\*\//g, "");

const moduleSource = (directory: string): string => {
    const found = giModules.find((entry) => entry.directory === directory);
    expect(found, `expected generated module for ${directory}`).toBeDefined();

    return stripDocComments(found?.source ?? "");
};

const registerModuleLevelPromisifyTests = (): void => {
    it("promisifies a module-level async function against its finish sibling", () => {
        const source = gioSource();
        expect(source).toContain(BUS_GET_SIGNATURE);
        expect(source).toContain(BUS_GET_PROMISIFY_CALL);
        expect(source).toContain("export function busGetFinish(res: AsyncResult): DBusConnection {");
    });

    it("promisifies a static async constructor against its static finish", () => {
        const source = gioSource();
        expect(source).toContain(DBUS_CONNECTION_NEW_SIGNATURE);
        expect(source).toContain(DBUS_CONNECTION_NEW_PROMISIFY_CALL);
        expect(source).toContain("static newFinish(res: AsyncResult): DBusConnection {");
    });

    it("parses the glib:finish-func annotation into the function model", () => {
        const gio = namespaceNamed("Gio");
        const busGet = gio?.functions.find((fn) => fn.name === "bus_get");
        expect(busGet?.finishFunc).toBe("bus_get_finish");
    });
};

const registerUnpromisifiedTests = (): void => {
    it("leaves a function callback-based when its finish needs more than the async result", () => {
        const source = giSource("gtk");
        expect(source).toContain(SHOW_URI_FULL_CALLBACK_SIGNATURE);
        expect(source).not.toContain(SHOW_URI_FULL_PROMISE_SIGNATURE);
    });

    it("does not promisify a synchronous method that only carries a progress callback", () => {
        const source = gioSource();
        expect(source).toContain(FILE_COPY_SIGNATURE);
        expect(source).not.toContain(FILE_COPY_PROMISE_SIGNATURE);
    });

    it("does not promisify a static async op that also takes a non-async callback", () => {
        expect(gioSource()).toContain(DBUS_OBJECT_MANAGER_CLIENT_NEW_SIGNATURE);
    });
};

const registerAnnotatedFinishTests = (): void => {
    it("pairs through the annotation when the finish name breaks the naming convention", () => {
        const gio = namespaceNamed("Gio");
        const methods = gio?.interfaces.find((candidate) => candidate.name === "File")?.methods ?? [];
        const asyncFn = methods.find((method) => method.name === "replace_contents_bytes_async");

        const finishFn =
            asyncFn === undefined
                ? undefined
                : matchAsyncFinish(library, { ...asyncFn, finishFunc: "replace_contents_finish" }, methods);

        expect(finishFn?.name).toBe("replace_contents_finish");
    });

    it("pairs through an annotation that holds the finish C identifier", () => {
        expect(giSource("gdkpixbuf")).toContain(PIXBUF_NEW_FROM_STREAM_AT_SCALE_SIGNATURE);
    });

    it("promisifies an instance async method against its annotated static finish", () => {
        const gdkpixbuf = giSource("gdkpixbuf");
        expect(gdkpixbuf).toContain(PIXBUF_SAVE_TO_STREAMV_SIGNATURE);
        expect(gdkpixbuf).toContain("Pixbuf.saveToStreamFinish.bind(Pixbuf)");
    });

    it("promisifies an instance async method against its name-matched static finish", () => {
        expect(gioSource()).toContain(IO_STREAM_SPLICE_SIGNATURE);
    });
};

describe("codegen gi pipeline", () => {
    it("resolves the transitive dependency closure of Gtk and Adw", () => {
        const names = library.namespaces.keys().toArray();
        expect(names).toEqual(expect.arrayContaining(["GLib", "GObject", "Gio", "Gdk", "Gsk", "Gtk", "Adw"]));
    });

    it("emits one module per namespace under the expected directory", () => {
        for (const { directory } of giModules) {
            expect(directory).toMatch(/^[a-z0-9]+$/);
        }

        expect(giModules).toHaveLength(library.namespaces.size);
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
        const source = giSource("gio");
        expect(source).toContain("loadContents(cancellable: Cancellable | null): [boolean, number[], string | null]");
        expect(source).not.toContain("[boolean, number[], number, string]");
    });

    it("returns a bare array when the only surfaced out is an array with a folded length", () => {
        const source = giSource("pango");
        expect(source).toContain("listFamilies(): FontFamily[]");
        expect(source).not.toContain("listFamilies(): [FontFamily[], number]");
    });

    it("keeps an unlinked length out-parameter in the return tuple", () => {
        const source = giSource("glib");
        expect(source).toContain("getGroups(): [string[], number]");
    });

    it("drops a skip-annotated return value from the surfaced result", () => {
        const source = giSource("glib");

        expect(source).toContain(
            "static split(uriRef: string, flags: UriFlags): " +
            "[string | null, string | null, string | null, number, string, string | null, string | null]",
        );

        expect(source).not.toContain("[boolean, string, string, string, number, string, string, string]");
    });
});

describe("codegen async promisification", () => {
    registerModuleLevelPromisifyTests();
    registerUnpromisifiedTests();
    registerAnnotatedFinishTests();
});

describe("codegen notify detail signals", () => {
    it("keys each introduced property's notify detail off GObject.Object's notify member", () => {
        const source = giSource("gobject");
        expect(source).toContain('"notify::source-property": ObjectSignals["notify"];');
        expect(source).toContain('"notify::source-property": ObjectSignalEmit["notify"];');
    });

    it("qualifies the notify member reference across namespaces", () => {
        const source = giSource("gtk");
        expect(source).toContain('"notify::visible": GObject.ObjectSignals["notify"];');
        expect(source).toContain('"notify::visible": GObject.ObjectSignalEmit["notify"];');
    });

    it("inherits a property's notify detail through the parent map rather than re-listing it", () => {
        const source = giSource("gtk");
        const buttonSignals = source.slice(source.indexOf("export interface ButtonSignals"));
        const buttonBody = buttonSignals.slice(0, buttonSignals.indexOf("}"));
        expect(buttonBody).not.toContain('"notify::visible"');
    });

    it("gives a class that introduces properties but no signals its own typed overloads", () => {
        const source = giSource("gobject");
        expect(source).toContain("export interface Binding {");
        expect(source).toContain("connect<K extends keyof BindingSignals>");
        expect(source).toContain("emit<K extends keyof BindingSignalEmit>");
    });
});

describe("codegen property maps", () => {
    it("maps each introduced property to its accessor type and chains the parent map", () => {
        const source = giSource("gtk");
        expect(source).toContain("export interface ButtonProperties extends WidgetProperties {");
        expect(source).toContain("label: string;");
        expect(source).toContain("__properties__: ButtonProperties;");
    });

    it("qualifies the parent map across namespaces", () => {
        const source = giSource("gtk");
        expect(source).toContain("export interface WidgetProperties extends GObject.InitiallyUnownedProperties {");
    });

    it("carries interface properties typed against the interface that declares them", () => {
        const source = giSource("gtk");
        const properties = source.slice(source.indexOf("export interface ButtonProperties"));
        const body = properties.slice(0, properties.indexOf("}"));
        expect(body).toContain("actionTarget: GLib.Variant | null;");
        expect(body).not.toContain("visible: boolean;");
    });

    it("omits write-only properties", () => {
        const source = giSource("gtk");
        const properties = source.slice(source.indexOf("export interface CheckButtonProperties"));
        const body = properties.slice(0, properties.indexOf("}"));
        expect(body).toContain("active: boolean;");
        expect(body).not.toContain("group:");
    });
});

describe("codegen GObject item comparators", () => {
    const itemComparatorSignature = "(a: GObject.Object | null, b: GObject.Object | null)";
    const itemComparatorArgs = 't.callback([t.object("borrowed"), t.object("borrowed"), t.uint64], t.int32';
    const itemEqualityArgs = 't.callback([t.object("borrowed"), t.object("borrowed")], t.boolean';
    const itemEqualityFullArgs = 't.callback([t.object("borrowed"), t.object("borrowed"), t.uint64], t.boolean';

    it("types ListStore comparator callbacks over borrowed object items", () => {
        const source = giSource("gio");
        expect(source).toContain(`sort(compareFunc: ${itemComparatorSignature} => number): void`);

        expect(source).toContain(
            `insertSorted(item: GObject.Object, compareFunc: ${itemComparatorSignature} => number): number`,
        );

        expect(source).toContain(
            `findWithEqualFunc(item: GObject.Object | null, equalFunc: ${itemComparatorSignature} => boolean): ` +
            "[boolean, number]",
        );

        expect(source).toContain(
            `findWithEqualFuncFull(item: GObject.Object | null, equalFunc: ${itemComparatorSignature} => boolean): ` +
            "[boolean, number]",
        );

        expect(source).toContain(`${itemComparatorArgs}, { userDataIndex: 2, scope: "call" })`);
        expect(source).toContain(`${itemEqualityArgs}, { scope: "call" })`);
        expect(source).toContain(`${itemEqualityFullArgs}, { userDataIndex: 2, scope: "call" })`);
    });

    it("types CustomSorter comparator callbacks over borrowed object items", () => {
        const source = giSource("gtk");
        expect(source).toContain(`static new(sortFunc: (${itemComparatorSignature} => number) | null): CustomSorter`);
        expect(source).toContain(`setSortFunc(sortFunc: (${itemComparatorSignature} => number) | null): void`);
        expect(source).toContain(`${itemComparatorArgs}, { hasDestroy: true, userDataIndex: 2, scope: "notified" })`);
    });

    it("keeps raw-pointer comparator callbacks outside GObject item containers", () => {
        const source = giSource("glib");
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
        const gtk = getSource(reactPipeline, "gtk");
        expect(gtk).toContain('import "@gtkx/gi/gtk";');
        expect(gtk).not.toContain('import "@gtkx/gi/adw";');
    });

    it("imports a cross-namespace parent Props type from the sibling namespace module by relative path", () => {
        const adw = getSource(reactPipeline, "adw");
        expect(adw).toMatch(/import \{[^}]*type GtkWidgetProps[^}]*\} from "\.\.\/gtk\/gtk\.js";/);
    });

    it("counts the widget intrinsics it emitted", () => {
        expect(reactPipeline.intrinsicElementCount).toBeGreaterThan(0);
    });

    it("emits page elements as lazy-element components", () => {
        const gtk = getSource(reactPipeline, "gtk");

        expect(gtk).toContain(
            "export const GtkNotebookPage: (props: GtkNotebookPageElementProps) => ReactNode = " +
            'createElementComponent("GtkNotebookPage");',
        );

        expect(gtk).toContain('createElementComponent("GtkStackPage")');
    });
});

describe("codegen configurable element components", () => {
    const overridden = getSource(
        generateJsxFiles(library, {
            ...REACT_SURFACE,
            components: {
                ...REACT_SURFACE.components,
                GtkButton: { module: "@example/wrappers", export: "withButton" },
            },
        }),
        "gtk",
    );

    it("wraps a plain element with the user's component and imports it", () => {
        expect(overridden).toContain('import { withButton } from "@example/wrappers";');

        expect(overridden).toContain(
            "export const GtkButton: (props: GtkButtonProps) => ReactNode = " +
            'withButton(createElementComponent("GtkButton"));',
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
        const gtk = getSource(
            generateJsxFiles(library, {
                ...REACT_SURFACE,
                components: {
                    ...REACT_SURFACE.components,
                    GtkWindow: { module: "@example/wrappers", export: "withWindow" },
                },
            }),
            "gtk",
        );

        expect(gtk).toContain('withWindow(createElementComponent("GtkWindow"))');
        expect(gtk).not.toContain('createWindowComponent(createElementComponent("GtkWindow"))');
    });

    it("leaves elements unwrapped without any override", () => {
        expect(getSource(reactPipeline, "gtk")).toContain(
            'export const GtkButton: (props: GtkButtonProps) => ReactNode = createElementComponent("GtkButton");',
        );
    });
});

describe("codegen widget-slot props", () => {
    it("widens a settable GObject-class property into a ReactElement slot", () => {
        const gtk = getSource(reactPipeline, "gtk");
        expect(interfaceBody(gtk, "GtkWindow")).toContain("titlebar?: Gtk$.Widget | ReactElement | null | undefined;");
    });

    it("widens a text view's buffer into a ReactElement slot", () => {
        const gtk = getSource(reactPipeline, "gtk");

        expect(interfaceBody(gtk, "GtkTextView")).toContain(
            "buffer?: Gtk$.TextBuffer | ReactElement | null | undefined;",
        );
    });

    it("keeps the single-child `child` property a plain widget reference, not a slot", () => {
        const body = interfaceBody(getSource(reactPipeline, "gtk"), "GtkButton");
        expect(body).toContain("child?: Gtk$.Widget | null | undefined;");
        expect(body).not.toContain("child?: Gtk$.Widget | ReactElement");
    });

    it("extends the configured base props interface on a container-prop host", () => {
        const adw = getSource(reactPipeline, "adw");

        expect(adw).toMatch(
            /import \{[^}]*type GtkHeaderBarProps as GtkHeaderBarPropsBase[^}]*\} from "@gtkx\/react\/internal";/,
        );

        expect(adw).toMatch(/export interface AdwHeaderBarProps<[^>]*> extends GtkHeaderBarPropsBase,/);
    });

    it("extends the configured base props interface on GtkWidget", () => {
        const gtk = getSource(reactPipeline, "gtk");

        expect(gtk).toMatch(
            /import \{[^}]*type GtkWidgetProps as GtkWidgetPropsBase[^}]*\} from "@gtkx\/react\/internal";/,
        );

        expect(gtk).toMatch(/export interface GtkWidgetProps<[^>]*> extends GtkWidgetPropsBase,/);
    });
});

describe("codegen applied element props", () => {
    it("extends the hand-declared props interface for a value prop host", () => {
        const gtk = getSource(reactPipeline, "gtk");
        expect(gtk).toMatch(/export interface GtkDropTargetProps<[^>]*> extends GtkDropTargetPropsBase,/);
    });

    it("extends the configured placement props on the child element's interface", () => {
        const gio = getSource(reactPipeline, "gio");

        expect(gio).toMatch(
            /import \{[^}]*type GActionGroupProps as GActionGroupPropsBase[^}]*\} from "@gtkx\/react\/internal";/,
        );

        expect(gio).toMatch(/export interface GActionGroupProps<[^>]*> extends GActionGroupPropsBase/);
    });

    it("emits lazy-element props from the page class interface", () => {
        const gtk = getSource(reactPipeline, "gtk");

        expect(gtk).toContain(
            'export type GtkStackPageElementProps = Omit<GtkStackPageProps, "child"> & { children?: ReactNode };',
        );

        expect(gtk).toMatch(/export type GtkNotebookPageElementProps = Omit<GtkNotebookPageProps, [^;>]*>[^;]*;/);
        expect(interfaceBody(gtk, "GtkNotebookPage")).toContain("tabLabel?: string | null | undefined;");
    });
});

describe("codegen read-only props", () => {
    it("omits the settable line for a read-only property but keeps its notify handler", () => {
        const gtk = getSource(reactPipeline, "gtk");
        const widgetBody = interfaceBody(gtk, "GtkWidget");
        expect(widgetBody).not.toContain("parent?: Gtk$.Widget | null;");
        expect(widgetBody).toContain("onNotifyParent?:");
    });

    it("keeps the settable line for a writable property", () => {
        const gtk = getSource(reactPipeline, "gtk");
        const widgetBody = interfaceBody(gtk, "GtkWidget");
        expect(widgetBody).toContain("opacity?: number | null | undefined;");
        expect(widgetBody).toContain("onNotifyOpacity?:");
    });
});

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

    it("extends named-slot elements from the configured base props types", () => {
        const adw = getSource(reactPipeline, "adw");
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
    it("names every exported props interface after an element, abstract base or implemented interface", () => {
        const sources = jsxSources();
        const declaredProps = matchAll(sources, /export interface (\w+Props)\b/g);
        const elementGlibNames = matchAll(sources, /^[ \t]*(\w+): \w+Props;$/gm);

        const allowed = new Set([
            ...elementGlibNames.map((name) => `${name}Props`),
            ...abstractPropsNames(),
            ...interfacePropsNames(),
        ]);

        const offenders = declaredProps.filter((name) => !allowed.has(name));
        expect(offenders, `unexpected props interface names: ${offenders.join(", ")}`).toEqual([]);
    });
});
