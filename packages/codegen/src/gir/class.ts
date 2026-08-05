import type { ParseContext } from "./type-id.js";
import { annotationsFromNode, type GirAnnotations } from "./annotations.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { type GirCallable, parseCallable } from "./parameter.js";
import { attr, getChildren, getDoc, GIR_CONSTRUCTOR_TAG, isAttrTrue, nameAttr, type RawNode } from "./parse.js";
import { type GirProperty, propertyFromNode } from "./property.js";

/** A `<virtual-method>` on a class or interface: the vtable slot's own documentation and signature. */
type GirVirtualMethod = GirCallable & {
    /** Method GIR names as invoking this slot, absent when the slot has no invoker. */
    invoker: string | undefined;
};

/** A `<class>` or `<interface>` declared by a GIR namespace. */
type GirClass = {
    /** Name GIR gives the type, without its namespace prefix. */
    name: string;
    /** Documentation GIR carries for the type. */
    doc: string | undefined;
    /** Release and deprecation annotations GIR carries on the type. */
    annotations: GirAnnotations;
    /** C type of an instance, such as `GtkWidget`. */
    cType: string | undefined;
    /** The class it derives from, qualified when it lives in another namespace. */
    parent: string | undefined;
    /** GType name the type registers under, such as `GtkWidget`. */
    glibTypeName: string | undefined;
    /** C function returning the GType, such as `gtk_widget_get_type`. */
    glibGetType: string | undefined;
    /** Record holding the class or interface vtable, which virtual method bindings are laid out against. */
    glibTypeStruct: string | undefined;
    /** C function that takes a reference, on a type that manages its own refcount. */
    glibRefFunc: string | undefined;
    /** C function that drops a reference, on a type that manages its own refcount. */
    glibUnrefFunc: string | undefined;
    /** Whether the type is its own GType fundamental rather than a GObject descendant. */
    // eslint-disable-next-line gtkx/boolean-name
    fundamental: boolean;
    /** Whether the class cannot be instantiated on its own. */
    isAbstract: boolean;
    /** Whether the type came from an `<interface>` rather than a `<class>`. */
    isInterface: boolean;
    /** Whether GIR exposes the type to bindings; codegen skips it when false. */
    // eslint-disable-next-line gtkx/boolean-name
    introspectable: boolean;
    /** Interfaces the class implements. */
    implements: string[];
    /** Types an implementer of this interface must also provide. */
    prerequisites: string[];
    /** Methods taking an instance. */
    methods: GirFunction[];
    /** Functions returning a new instance. */
    constructors: GirFunction[];
    /** Functions namespaced under the type that take no instance. */
    functions: GirFunction[];
    /** GObject properties the type declares. */
    properties: GirProperty[];
    /** GObject signals the type declares. */
    signals: GirCallable[];
    /** Methods that invoke one of the type's virtual methods. */
    vfuncInvokers: string[];
    /** Virtual methods the type declares, carrying the documentation their vtable slots are generated from. */
    vfuncs: GirVirtualMethod[];
};

const virtualMethodsFromNode = (node: RawNode, context: ParseContext): GirVirtualMethod[] =>
    getChildren(node, "virtual-method").map((vfunc) => ({
        ...parseCallable(vfunc, context),
        invoker: attr(vfunc, "invoker"),
    }));

const classFromNode = (node: RawNode, isInterface: boolean, context: ParseContext): GirClass => ({
    name: nameAttr(node),
    doc: getDoc(node),
    annotations: annotationsFromNode(node),
    cType: attr(node, "c:type"),
    parent: attr(node, "parent"),
    glibTypeName: attr(node, "glib:type-name"),
    glibGetType: attr(node, "glib:get-type"),
    glibTypeStruct: attr(node, "glib:type-struct"),
    glibRefFunc: attr(node, "glib:ref-func"),
    glibUnrefFunc: attr(node, "glib:unref-func"),
    fundamental: isAttrTrue(node, "glib:fundamental"),
    isAbstract: isAttrTrue(node, "abstract"),
    isInterface,
    introspectable: isAttrTrue(node, "introspectable", true),
    implements: getChildren(node, "implements")
        .map((implement) => attr(implement, "name"))
        .filter((name): name is string => name !== undefined),
    prerequisites: getChildren(node, "prerequisite")
        .map((prerequisite) => attr(prerequisite, "name"))
        .filter((name): name is string => name !== undefined),
    methods: getChildren(node, "method").map((method) => functionFromNode(method, context)),
    constructors: getChildren(node, GIR_CONSTRUCTOR_TAG).map((ctor) => functionFromNode(ctor, context)),
    functions: getChildren(node, "function").map((fn) => functionFromNode(fn, context)),
    properties: getChildren(node, "property").map((property) => propertyFromNode(property, context)),
    signals: getChildren(node, "glib:signal").map((signal) => parseCallable(signal, context)),
    vfuncInvokers: getChildren(node, "virtual-method")
        .map((vfunc) => attr(vfunc, "invoker"))
        .filter((invoker): invoker is string => invoker !== undefined),
    vfuncs: virtualMethodsFromNode(node, context),
});

export { classFromNode, type GirClass, type GirVirtualMethod };
