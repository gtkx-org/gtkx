import type { ParseContext } from "./type-id.js";
import { documentedFromNode, type GirAnnotations } from "./annotations.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { type GirCallable, parseCallable } from "./parameter.js";
import { attr, getChildren, GIR_CONSTRUCTOR_TAG, isAttrTrue, type RawNode } from "./parse.js";
import { type GirProperty, propertyFromNode } from "./property.js";

type GirVirtualMethod = GirCallable & {
    invoker: string | undefined;
};

type GirSignal = GirCallable & {
    isDetailed: boolean;
};

type GirClass = {
    name: string;
    doc: string | undefined;
    annotations: GirAnnotations;
    cType: string | undefined;
    parent: string | undefined;
    glibTypeName: string | undefined;
    glibGetType: string | undefined;
    glibTypeStruct: string | undefined;
    glibRefFunc: string | undefined;
    glibUnrefFunc: string | undefined;
    fundamental: boolean;
    isAbstract: boolean;
    isInterface: boolean;
    introspectable: boolean;
    implements: string[];
    prerequisites: string[];
    methods: GirFunction[];
    constructors: GirFunction[];
    functions: GirFunction[];
    properties: GirProperty[];
    signals: GirSignal[];
    vfuncs: GirVirtualMethod[];
};

const virtualMethodsFromNode = (node: RawNode, context: ParseContext): GirVirtualMethod[] =>
    getChildren(node, "virtual-method").map((vfunc) => ({
        ...parseCallable(vfunc, context),
        invoker: attr(vfunc, "invoker"),
    }));

const classFromNode = (node: RawNode, isInterface: boolean, context: ParseContext): GirClass => ({
    ...documentedFromNode(node),
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
    signals: getChildren(node, "glib:signal").map((signal) => ({
        ...parseCallable(signal, context),
        isDetailed: isAttrTrue(signal, "detailed"),
    })),
    vfuncs: virtualMethodsFromNode(node, context),
});

export { classFromNode, type GirClass, type GirSignal, type GirVirtualMethod };
