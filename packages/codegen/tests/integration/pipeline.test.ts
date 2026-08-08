/* eslint-disable gtkx/no-library-prefix */
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
import { annotationsFromNode } from "../../src/gir/annotations.js";
import { readBuiltinElements } from "../../src/react/element-config.js";
import { matchAsyncFinish } from "../../src/store/gi/async.js";
import { generateNamespaceModule } from "../../src/store/gi/pipeline.js";
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
const REACT_SURFACE = await readBuiltinElements(REACT_SUBEXPORTS, GI_STORE_DIR);
const reactPipeline = generateJsxFiles(library, REACT_SURFACE);

const BUS_GET_SIGNATURE =
    "export function busGet(busType: BusType, cancellable?: Cancellable | null): Promise<DBusConnection> {";

const BUS_GET_PROMISIFY_CALL = "return promisify(gBusGet, busGetFinish, cancellable, busType);";
const THROWS_TAG = "@throws A `GLib.Error` carrying the failing operation's domain, code, and message.";

const DBUS_CONNECTION_NEW_SIGNATURE =
    "static new(stream: IOStream, guid: string | null, flags: DBusConnectionFlags, " +
    "observer: DBusAuthObserver | null, cancellable?: Cancellable | null): Promise<DBusConnection> {";

const DBUS_CONNECTION_NEW_PROMISIFY_CALL =
    "return promisify(gDbusConnectionNew, this.newFinish.bind(this), cancellable, " +
    "getHandle(stream), guid, flags, observer == null ? null : getHandle(observer));";

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
    const table = metadata.slice(metadata.indexOf("export const defaultProps"));
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

const documentedModuleSource = (directory: string): string => {
    const found = giModules.find((entry) => entry.directory === directory);
    expect(found, `expected generated module for ${directory}`).toBeDefined();

    return found?.source ?? "";
};

const moduleSource = (directory: string): string => stripDocComments(documentedModuleSource(directory));

const unwrapDocComment = (block: string): string =>
    block
        .split("\n")
        .map((line) => line.replace(/^\s*\/?\*+\/?\s?/, ""))
        .join(" ")
        .replaceAll(/\s+/g, " ")
        .trim();

const docCommentBefore = (source: string, anchor: string): string => {
    const index = source.indexOf(anchor);
    expect(index, `expected ${anchor} in the generated module`).toBeGreaterThan(-1);

    return unwrapDocComment(source.slice(source.lastIndexOf("/**", index), index));
};

const declarationFrom = (source: string, head: string): string => {
    const index = source.indexOf(head);
    expect(index, `expected ${head} in the generated module`).toBeGreaterThan(-1);

    return source.slice(index, source.indexOf("\n}", index));
};

const declarationBody = (source: string, head: string): string =>
    declarationFrom(source, head)
        .slice(head.length)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join("\n");

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

const plainRecord = (name: string): GirRecord => ({
    isVtable: false,
    name,
    doc: undefined,
    annotations: annotationsFromNode(undefined),
    cType: `G${name}`,
    glibTypeName: undefined,
    glibGetType: undefined,
    glibRefFunc: undefined,
    glibUnrefFunc: undefined,
    copyFunc: undefined,
    freeFunc: undefined,
    disguised: false,
    opaque: false,
    introspectable: true,
    fields: [],
    methods: [],
    constructors: [],
    functions: [],
    isUnion: false,
});

const generateClashingListModelImpl = (): string => generateWithRecord("Gio", plainRecord("ListModelImpl"));

const generateWithRecord = (namespaceName: string, record: GirRecord): string => {
    const namespace = namespaceNamed(namespaceName);

    if (namespace === undefined) {
        throw new Error(`expected the ${namespaceName} namespace`);
    }

    namespace.records.push(record);

    try {
        return generateNamespaceModule(namespace, library);
    } finally {
        namespace.records.pop();
    }
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

        expect(source).toContain(`${itemComparatorArgs}, { hasUserData: true, userDataIndex: 2, scope: "call" })`);
        expect(source).toContain(`${itemEqualityArgs}, { scope: "call" })`);
        expect(source).toContain(`${itemEqualityFullArgs}, { hasUserData: true, userDataIndex: 2, scope: "call" })`);
    });

    it("types CustomSorter comparator callbacks over borrowed object items", () => {
        const source = giSource("gtk");
        expect(source).toContain(`static new(sortFunc: (${itemComparatorSignature} => number) | null): CustomSorter`);
        expect(source).toContain(`setSortFunc(sortFunc: (${itemComparatorSignature} => number) | null): void`);

        expect(source).toContain(
            `${itemComparatorArgs}, { hasDestroy: true, hasUserData: true, userDataIndex: 2, scope: "notified" })`,
        );
    });

    it("keeps raw-pointer comparator callbacks outside GObject item containers", () => {
        const source = giSource("glib");
        expect(source).toContain("export type CompareDataFunc = (a: number | null, b: number | null) => number;");
        expect(source).toContain("export type EqualFunc = (a: number | null, b: number | null) => boolean;");
        expect(source).not.toContain(itemComparatorSignature);
    });
});

describe("codegen type-erased callback parameters", () => {
    it("drops a callable whose callback is a GCallback the callee hands user data to", () => {
        const gtk = giSource("gtk");
        expect(gtk).toContain("class CClosureExpression extends Expression");
        expect(gtk).not.toContain('"gtk_cclosure_expression_new"');
        expect(giSource("gio")).not.toContain('"g_cancellable_connect"');
        expect(giSource("gobject")).not.toContain('"g_signal_group_connect_data"');
    });

    it("keeps a callback that reads its user data off the argument it is handed", () => {
        const source = giSource("gdk");
        expect(source).toContain("gdk_content_register_serializer");

        expect(source).toContain(
            't.callback([t.object("borrowed")], t.void, { hasDestroy: true, hasUserData: true, scope: "notified" })',
        );
    });
});

describe("codegen React pipeline", () => {
    it("emits a module per namespace plus the merged metadata", () => {
        expect(reactPipeline.namespaces.length).toBeGreaterThan(0);

        for (const { source } of reactPipeline.namespaces) {
            expect(source.length).toBeGreaterThan(0);
        }

        expect(reactPipeline.metadata).toContain("export const signals");
        expect(reactPipeline.metadata).toContain("export const constructOnlyProps");
        expect(reactPipeline.metadata).toContain("export const defaultProps");
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

    it("omits the `child` property the configured children slot writes", () => {
        const body = interfaceBody(getSource(reactPipeline, "gtk"), "GtkButton");
        expect(body).not.toContain("child?:");
        expect(body).not.toContain("onNotifyChild?:");
    });

    it("omits the `content` property the configured children slot writes, keeping its sibling slot", () => {
        const body = interfaceBody(getSource(reactPipeline, "adw"), "AdwNavigationSplitView");
        expect(body).not.toContain("content?:");
        expect(body).toContain("sidebar?: Adw$.NavigationPage | ReactElement | null | undefined;");
    });

    it("keeps an object property no children slot writes", () => {
        const body = interfaceBody(getSource(reactPipeline, "gtk"), "GtkDragSource");
        expect(body).toContain("content?: Gdk$.ContentProvider | ReactElement | null | undefined;");
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
            /import \{[^}]*type ActionGroupProps as ActionGroupPropsBase[^}]*\} from "@gtkx\/react\/internal";/,
        );

        expect(gio).toMatch(/export interface GActionGroupProps<[^>]*> extends ActionGroupPropsBase/);
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

describe("vtable slots that take a GError", () => {
    it("marks a throwing slot so a call appends the trailing GError the parameters leave out", () => {
        expect(moduleSource("gio")).toContain(
            "vfuncName: \"init\",\n            byteOffset: 16,\n            vtableSize: 24,\n" +
            "            argDescriptors: [t.object(\"borrowed\"), t.object(\"borrowed\")],\n" +
            "            returnDescriptor: t.boolean,\n            canThrow: true,",
        );
    });

    it("leaves a slot that takes no GError unmarked", () => {
        expect(moduleSource("gio")).toContain(
            "vfuncName: \"get_n_items\",\n            byteOffset: 24,\n            vtableSize: 40,\n" +
            "            argDescriptors: [t.object(\"borrowed\")],\n" +
            "            returnDescriptor: t.uint32,\n        },",
        );
    });
});

describe("vtable slots with array out parameters", () => {
    it("emits local_command_line with its inout argument vector", () => {
        const gio = moduleSource("gio");
        expect(gio).toContain("vfuncLocalCommandLine(arguments_: string[]): [boolean, string[], number]");

        expect(gio).toContain(
            "argDescriptors: [t.object(\"borrowed\"), " +
            "t.ref(t.array(t.string(\"full\"), \"array\", \"full\"), true), t.ref(t.int32)],",
        );
    });

    it("emits get_default_attributes with both of its out arrays", () => {
        const gtk = moduleSource("gtk");
        expect(gtk).toContain("vfuncGetDefaultAttributes(): [string[], string[]]");
    });

    it("folds away the length parameter an out array carries, as a call does", () => {
        const gtk = moduleSource("gtk");
        expect(gtk).toContain("vfuncGetSelection(): [boolean, AccessibleTextRange[]]");

        expect(gtk).toContain(
            "vfuncGetAttributes(offset: number): [boolean, AccessibleTextRange[], string[], string[]]",
        );
    });

    it("folds the length out of a slot whose only out parameters are an array and its length", () => {
        const pango = moduleSource("pango");
        expect(pango).toContain("vfuncListFaces(): FontFace[]");
        expect(pango).toContain("vfuncListSizes(): number[] | null");
    });
});

describe("vtable slot member visibility", () => {
    it("marks a class slot protected, so only a subclass chaining up reaches it", () => {
        const gtk = moduleSource("gtk");
        expect(gtk).toContain("protected vfuncMeasure(orientation: Orientation, forSize: number)");
        expect(gtk).toContain("protected vfuncCloseRequest(): boolean {");
        expect(moduleSource("gobject")).toContain("protected vfuncConstructed(): void {");
    });

    it("leaves an interface slot public, which a TypeScript interface has no way to restrict", () => {
        const gio = moduleSource("gio");
        expect(gio).toContain("\n    vfuncGetItemType(): bigint;");
        expect(gio).not.toContain("protected vfuncGetItemType");
    });

    it("leaves a class slot public when an implemented interface declares the same name", () => {
        const gio = moduleSource("gio");
        expect(gio).toContain("\n    vfuncTell(): bigint {");
        expect(gio).not.toContain("protected vfuncTell");
        expect(gio).not.toContain("protected vfuncGetInfo");
    });

    it("drops a slot an ancestor class already declares at the same vtable offset", () => {
        const gobject = moduleSource("gobject");
        expect(gobject).toContain("callVfunc(Object, \"vfuncConstructed\", this, [])");
        expect(gobject).not.toContain("callVfunc(InitiallyUnowned, \"vfuncConstructed\", this, [])");
    });

    it("keeps a same-named slot an ancestor class declares at a different vtable offset", () => {
        expect(moduleSource("adw")).toContain("callVfunc(ActionRow, \"vfuncActivate\", this, [])");
        expect(moduleSource("gtk")).toContain("callVfunc(ListBoxRow, \"vfuncActivate\", this, [])");
    });
});

describe("generated type name collisions", () => {
    it("rejects a namespace whose own symbol claims the name an implementer type takes", () => {
        expect(generateClashingListModelImpl).toThrow(
            /The generated type 'ListModelImpl' is declared for both Gio.ListModelImpl and Gio.ListModel/,
        );
    });

    it("takes a namespace whose symbols claim names no implementer type takes", () => {
        expect(generateWithRecord("Gio", plainRecord("ListModelHandle"))).toContain("export class ListModelHandle");
    });
});

describe("interface implementer types", () => {
    it("declares the vfuncs an implementer supplies, and none of the interface's methods", () => {
        const body = declarationBody(moduleSource("gio"), "export interface ListModelImpl {");

        expect(body).toBe(
            "vfuncGetItemType?(): bigint;\n" +
            "vfuncGetNItems?(): number;\n" +
            "vfuncGetItem?(position: number): GObject.Object | null;",
        );
    });

    it("chains an implementer type onto the implementer type of each prerequisite interface", () => {
        expect(moduleSource("gtk")).toContain("export interface SectionModelImpl extends Gio.ListModelImpl {");
        expect(moduleSource("gtk")).toContain("export interface SymbolicPaintableImpl extends Gdk.PaintableImpl {");
        expect(moduleSource("gio")).toContain("export interface LoadableIconImpl extends IconImpl {");
    });

    it("leaves out a prerequisite that is a class, which the implementer already extends", () => {
        expect(moduleSource("gtk")).toContain("export interface EditableImpl {");
        expect(moduleSource("gtk")).toContain("export interface ScrollableImpl {");
    });

    it("emits nothing for an interface without vtable slots", () => {
        const gtk = moduleSource("gtk");
        expect(gtk).toContain("export abstract class Orientable");
        expect(gtk).not.toContain("OrientableImpl");
        expect(gtk).not.toContain("RootImpl");
        expect(moduleSource("gobject")).not.toContain("TypePluginImpl");
    });

    it("keeps the implementer type out of the runtime module", () => {
        const gio = moduleSource("gio");
        expect(gio).not.toContain("class ListModelImpl");
        expect(gio).not.toContain("const ListModelImpl");
    });

    it("ties the interface value to its implementer type", () => {
        const gio = moduleSource("gio");
        expect(gio).toContain("export abstract class ListModel {");
        expect(gio).toContain("declare static __impl__: Interface<ListModelImpl>[\"__impl__\"];");
        expect(gio).toContain("type Interface");
    });

    it("asks nothing of an implementer of an interface without vtable slots", () => {
        const orientable = declarationFrom(moduleSource("gtk"), "export abstract class Orientable {");
        expect(orientable).toContain("declare static __impl__: Interface<unknown>[\"__impl__\"];");
    });
});

describe("interface implementer slots a class may leave alone", () => {
    it("leads each slot with the virtual method's own text ahead of the implementer note", () => {
        const impl = declarationFrom(documentedModuleSource("gio"), "export interface ListModelImpl {");
        const doc = docCommentBefore(impl, "vfuncGetNItems?(): number;");

        expect(doc).toBe(
            "Gets the number of items in `this`. " +
            "Depending on the model implementation, calling this function may be " +
            "less efficient than iterating the list with increasing values for " +
            "`position` until `g_list_model_get_item()` returns `null`. " +
            "Fills the `get_n_items` vtable slot. Declare it on a class passed to `registerClass` " +
            "with `ListModel` in `implements`, which installs it in the interface vtable. Leaving it out " +
            "keeps whatever the interface installs by default, the way it does for a C implementer. " +
            "@returns the number of items in `this`. @since 2.44",
        );
    });

    it("marks every slot optional, so a GIR that grows one breaks no implementer", () => {
        const head = "export interface SectionModelImpl extends Gio.ListModelImpl {";
        const body = declarationBody(moduleSource("gtk"), head);
        expect(body).toBe("vfuncGetSection?(position: number): [number, number];");
    });

    it("keeps the interface's own callable slot required, which an instance always answers", () => {
        const listModel = declarationFrom(moduleSource("gio"), "export interface ListModel extends GObject.Object {");
        expect(listModel).toContain("vfuncGetNItems(): number;");
        expect(listModel).not.toContain("vfuncGetNItems?(): number;");
    });

    it("keeps a class slot required, which the class either overrides or inherits", () => {
        const gtk = moduleSource("gtk");
        expect(gtk).toContain("protected vfuncMeasure(orientation: Orientation, forSize: number)");
        expect(gtk).not.toContain("vfuncMeasure?(");
    });
});

describe("interfaces with no slot to fill", () => {
    it("brands an interface whose vtable introspection leaves out with unknown", () => {
        const gtk = moduleSource("gtk");
        expect(declarationFrom(gtk, "export abstract class Native {")).toContain("Interface<unknown>[\"__impl__\"]");
        expect(declarationFrom(gtk, "export abstract class FileChooser {")).toContain("Interface<unknown>");
        expect(moduleSource("gtk")).not.toContain("Interface<never>");
        expect(moduleSource("gobject")).not.toContain("Interface<never>");
    });
});

describe("interface vtable registration", () => {
    it("registers the slots of a vtable struct introspection describes", () => {
        expect(moduleSource("gio")).toContain("makeListModel, {\n    vfuncs: {");
        expect(moduleSource("gtk")).toContain("makeSelectionModel, {\n    vfuncs: {");
    });

    it("registers no layout for a vtable that declares no slots, nor for one it cannot see", () => {
        expect(moduleSource("gtk")).toContain("registerInterface(Orientable, resolveType(");
        expect(moduleSource("gtk")).not.toContain("makeOrientable, {");
        expect(moduleSource("gtk")).toContain("registerInterface(Native, resolveType(");
        expect(moduleSource("gtk")).not.toContain("makeNative, {");
        expect(moduleSource("gtk")).not.toContain("makeFileChooser, {");
    });

    it("names the accessor of every property a vtable slot backs", () => {
        expect(moduleSource("gio")).toContain(
            'properties: {\n        "enabled": {\n            getter: "getEnabled",\n        },',
        );

        expect(moduleSource("gtk")).toContain(
            'properties: {\n        "action-name": {\n' +
            '            getter: "getActionName",\n            setter: "setActionName",\n        },\n    },',
        );
    });

    it("takes each direction of a property on its own and leaves an unbacked one out", () => {
        expect(moduleSource("gtk")).toContain('properties: {\n        "text": {\n            getter: "getText",\n');
        expect(moduleSource("gtk")).not.toContain('setter: "setText"');

        expect(moduleSource("gio")).toContain(
            'properties: {\n        "advertised-protocols": {\n            setter: "setAdvertisedProtocols",\n',
        );

        expect(moduleSource("gtk")).not.toContain('"hadjustment": {');
    });
});

describe("vtable slot members carry their own documentation", () => {
    it("stands the chain-up note alone on a slot GObject-Introspection leaves undocumented", () => {
        const doc = docCommentBefore(documentedModuleSource("gtk"), "protected vfuncActivateOsk(): void {");

        expect(doc).toBe(
            "Invokes the `activate_osk` vtable slot. Override it on a class passed to `registerClass` " +
            "and chain up with `super.vfuncActivateOsk()`. It is `protected`, so only a subclass " +
            "chaining up reaches it.",
        );
    });

    it("leads a class slot with the virtual method's own text and return documentation", () => {
        const doc = docCommentBefore(documentedModuleSource("gtk"), "protected vfuncCloseRequest(): boolean {");

        expect(doc).toBe(
            "Class handler for the `Window.close-request` signal. " +
            "Invokes the `close_request` vtable slot. Override it on a class passed to `registerClass` " +
            "and chain up with `super.vfuncCloseRequest()`. It is `protected`, so only a subclass " +
            "chaining up reaches it. @returns Whether the window should be destroyed",
        );
    });

    it("keeps the live-instance warning on an interface slot, which stays callable", () => {
        const doc = docCommentBefore(documentedModuleSource("gio"), "vfuncGetItemType(): bigint;");

        expect(doc).toContain(
            "chain up with `super.vfuncGetItemType()`. Calling it from anywhere else re-enters " +
            "the slot on a live instance.",
        );
    });

    it("keeps the documentation the vtable field carries ahead of the note", () => {
        const doc = docCommentBefore(documentedModuleSource("gobject"), "protected vfuncConstructed(): void {");
        expect(doc).toMatch(/^the `constructed` function is called by `g_object_new\(\)`/);
        expect(doc).toContain("Invokes the `constructed` vtable slot.");
        expect(doc).toContain("chain up with `super.vfuncConstructed()`");
    });

    it("prefers the virtual method's own prose over the vtable field's", () => {
        const doc = docCommentBefore(
            documentedModuleSource("gtk"),
            "protected vfuncMeasure(orientation: Orientation, forSize: number)",
        );

        expect(doc).toMatch(/^Measures `this` in the orientation `orientation` and for the given `forSize`\./);
        expect(doc).toContain("chain up with `super.vfuncMeasure()`");
        expect(doc).toContain("@param orientation the orientation to measure");
    });
});

describe("block tags on generated callables", () => {
    it("names each emitted parameter with the prose GIR gives it", () => {
        const doc = docCommentBefore(documentedModuleSource("gtk"), "setSizeRequest(width: number, height: number)");
        expect(doc).toContain("@param width");
        expect(doc).toContain("should request");
    });

    it("carries the return value's prose", () => {
        const doc = docCommentBefore(documentedModuleSource("gtk"), "getFirstChild(): Widget | null {");
        expect(doc).toContain("@returns");
        expect(doc).toContain("first child");
    });

    it("names every slot of a folded out-parameter tuple", () => {
        const doc = docCommentBefore(documentedModuleSource("gtk"), "translateCoordinates(destWidget: Widget");
        expect(doc).toContain("@returns Tuple of:");
        expect(doc).toContain("- `result`:");
        expect(doc).toContain("- `destX`:");
        expect(doc).toContain("- `destY`:");
    });

    it("renames prose references to the emitted identifiers", () => {
        const doc = docCommentBefore(documentedModuleSource("gtk"), "translateCoordinates(destWidget: Widget");
        expect(doc).toContain("relative to `this`");
        expect(doc).not.toContain("src_widget");
    });

    it("carries the deprecation version and its replacement", () => {
        const doc = docCommentBefore(documentedModuleSource("gtk"), "show(): void {");
        expect(doc).toContain("@deprecated Since 4.10. Use `Gtk.Widget.setVisible()` instead");
    });

    it("carries the release a symbol appeared in", () => {
        const doc = docCommentBefore(documentedModuleSource("gtk"), "launchFinish(result: Gio.AsyncResult): boolean");
        expect(doc).toContain("@since 4.10");
    });

    it("documents the error a throwing callable raises", () => {
        const doc = docCommentBefore(documentedModuleSource("gtk"), "launchFinish(result: Gio.AsyncResult): boolean");
        expect(doc).toContain("@throws A `GLib.Error` carrying the failing operation's domain, code, and message.");
    });

    it("documents the resolved value of a promisified callable from its finish sibling", () => {
        const doc = docCommentBefore(documentedModuleSource("gtk"), "launch(parent: Window | null");
        expect(doc).toContain("@returns true if an application was launched");
        expect(doc).not.toContain("@param callback");
    });

    it("names the parameter a runtime override declares rather than the one GIR names", () => {
        const doc = docCommentBefore(documentedModuleSource("gobject"), "setBoxed(boxed: object | null)");
        expect(doc).toContain("@param boxed");
        expect(doc).not.toContain("@param vBoxed");
    });
});

describe("throws tags on generated callables", () => {
    it("documents the error a promisified callable rejects with from its finish sibling", () => {
        const doc = docCommentBefore(documentedModuleSource("gtk"), "open(parent: Window | null");
        expect(doc).toContain(THROWS_TAG);
    });

    it("documents the error a throwing vtable slot raises", () => {
        const doc = docCommentBefore(documentedModuleSource("gio"), "protected vfuncFill(count: number");
        expect(doc).toContain(THROWS_TAG);
    });

    it("leaves a vtable slot that cannot fail without a throws tag", () => {
        const doc = docCommentBefore(documentedModuleSource("gio"), "vfuncGetItemType(): bigint;");
        expect(doc).not.toContain(THROWS_TAG);
    });
});

describe("block tags on generated namespace functions", () => {
    it("drops the callback parameter a promisified namespace function no longer takes", () => {
        const doc = docCommentBefore(documentedModuleSource("gio"), BUS_GET_SIGNATURE);
        expect(doc).not.toContain("@param callback");
    });

    it("documents the resolved value and error from the finish sibling", () => {
        const doc = docCommentBefore(documentedModuleSource("gio"), BUS_GET_SIGNATURE);
        expect(doc).toContain("@returns a `GDBusConnection`");
        expect(doc).toContain(THROWS_TAG);
    });
});

describe("documentation on generated declarations other than methods", () => {
    it("documents an error domain and each of its codes", () => {
        const gio = documentedModuleSource("gio");
        expect(docCommentBefore(gio, "\n    NOT_FOUND: number;")).toContain("File not found.");
        expect(docCommentBefore(gio, "export const IOErrorEnum")).toContain("Error codes returned by GIO functions.");
    });

    it("documents the constructor props and property maps of a class", () => {
        const gtk = documentedModuleSource("gtk");
        const props = declarationFrom(gtk, "export interface WidgetConstructorProps");
        expect(docCommentBefore(props, "canTarget?:")).toContain("Whether the widget can receive pointer events.");
        const properties = declarationFrom(gtk, "export interface WidgetProperties");
        expect(docCommentBefore(properties, "canTarget:")).toContain("Whether the widget can receive pointer events.");
    });

    it("documents each writable field of a record's constructor props", () => {
        const props = declarationFrom(documentedModuleSource("gdk"), "export interface RGBAConstructorProps");
        expect(docCommentBefore(props, "red?:")).toContain("intensity of the red channel");
    });

    it("documents the interface value, its mixin maker, and its implementer type", () => {
        const gio = documentedModuleSource("gio");
        const lead = "`GListModel` is an interface that represents a mutable list of";
        expect(docCommentBefore(gio, "export abstract class ListModel {")).toContain(lead);
        expect(docCommentBefore(gio, "export const makeListModel:")).toContain(lead);
        expect(docCommentBefore(gio, "export interface ListModelImpl {")).toContain(lead);
    });

    it("documents signal-emit entries and notify details", () => {
        const emit = declarationFrom(documentedModuleSource("gio"), "export interface ListModelSignalEmit");
        expect(docCommentBefore(emit, "\"items-changed\":")).toContain("items were added to or removed");
        const signals = declarationFrom(documentedModuleSource("gtk"), "export interface ButtonSignals");
        expect(docCommentBefore(signals, "\"notify::label\":")).toContain("Text of the label inside the button");
    });

    it("strips media and DocBook markup from every generated module", () => {
        for (const module of giModules) {
            expect(module.source).not.toContain("<picture");
            expect(module.source).not.toContain("<itemizedlist");
            expect(module.source).not.toContain("linkend=");
            expect(module.source).not.toContain("<!-- -->");
        }
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
