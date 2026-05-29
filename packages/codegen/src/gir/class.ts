import { fieldFromNode, type GirField } from "./field.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { attr, attrBool, childrenOf, type RawNode } from "./parse.js";
import { type GirProperty, propertyFromNode } from "./property.js";
import { type GirSignal, signalFromNode } from "./signal.js";

/** A `<class>` or `<interface>` declaration. */
export type GirClass = {
    /** Local name inside the namespace (no prefix). */
    readonly name: string;
    readonly cType: string | undefined;
    /** GIR `parent`, possibly cross-namespace (e.g. `"GObject.InitiallyUnowned"`). */
    readonly parent: string | undefined;
    /** GLib type name (e.g. `"GtkWidget"`). */
    readonly glibTypeName: string | undefined;
    /** C symbol that returns the GType integer (e.g. `"gtk_widget_get_type"`). */
    readonly glibGetType: string | undefined;
    /** Local record name that holds this class's vtable (`glib:type-struct`). */
    readonly glibTypeStruct: string | undefined;
    /** Glib ref/unref/etc. function names on fundamentals; not used for GObject subclasses. */
    readonly glibRefFunc: string | undefined;
    readonly glibUnrefFunc: string | undefined;
    readonly glibSetValueFunc: string | undefined;
    readonly glibGetValueFunc: string | undefined;
    /** `glib:fundamental="1"` — a non-GObject fundamental type (e.g. `GdkEvent`, `GskRenderNode`). */
    readonly fundamental: boolean;
    readonly abstract: boolean;
    readonly final: boolean;
    readonly isInterface: boolean;
    readonly introspectable: boolean;
    /** Names of interfaces this class implements (cross-namespace possible). */
    readonly implements: readonly string[];
    /** Names of interfaces a `<interface>` requires (`<prerequisite>` elements). */
    readonly prerequisites: readonly string[];
    readonly methods: readonly GirFunction[];
    readonly constructors: readonly GirFunction[];
    readonly functions: readonly GirFunction[];
    readonly virtualMethods: readonly GirFunction[];
    readonly properties: readonly GirProperty[];
    readonly signals: readonly GirSignal[];
    readonly fields: readonly GirField[];
};

/**
 * Builds a {@link GirClass} from a `<class>` or `<interface>` element.
 *
 * @param node - The XML element
 * @param isInterface - `true` when the source element was `<interface>`
 */
export const classFromNode = (node: RawNode, isInterface: boolean): GirClass => ({
    name: attr(node, "name") ?? "",
    cType: attr(node, "c:type"),
    parent: attr(node, "parent"),
    glibTypeName: attr(node, "glib:type-name"),
    glibGetType: attr(node, "glib:get-type"),
    glibTypeStruct: attr(node, "glib:type-struct"),
    glibRefFunc: attr(node, "glib:ref-func"),
    glibUnrefFunc: attr(node, "glib:unref-func"),
    glibSetValueFunc: attr(node, "glib:set-value-func"),
    glibGetValueFunc: attr(node, "glib:get-value-func"),
    fundamental: attrBool(node, "glib:fundamental"),
    abstract: attrBool(node, "abstract"),
    final: attrBool(node, "final"),
    isInterface,
    introspectable: attr(node, "introspectable") !== "0",
    implements: childrenOf(node, "implements")
        .map((implement) => attr(implement, "name"))
        .filter((name): name is string => name !== undefined),
    prerequisites: childrenOf(node, "prerequisite")
        .map((prerequisite) => attr(prerequisite, "name"))
        .filter((name): name is string => name !== undefined),
    methods: childrenOf(node, "method").map((method) => functionFromNode(method, "method")),
    constructors: childrenOf(node, "constructor").map((ctor) => functionFromNode(ctor, "constructor")),
    functions: childrenOf(node, "function").map((function_) => functionFromNode(function_, "function")),
    virtualMethods: childrenOf(node, "virtual-method").map((vmethod) => functionFromNode(vmethod, "virtual-method")),
    properties: childrenOf(node, "property").map(propertyFromNode),
    signals: childrenOf(node, "glib:signal").map(signalFromNode),
    fields: childrenOf(node, "field").map(fieldFromNode),
});
