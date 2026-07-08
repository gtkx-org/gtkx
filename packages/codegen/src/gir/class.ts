import { functionFromNode, type GirFunction } from "./function.js";
import { type GirSignal, parseCallable } from "./parameter.js";
import { attr, attrBool, childrenOf, docOf, GIR_CONSTRUCTOR_TAG, nameAttr, type RawNode } from "./parse.js";
import { type GirProperty, propertyFromNode } from "./property.js";
import type { ParseContext } from "./type-id.js";

export type GirClass = {
    name: string;
    doc: string | undefined;
    cType: string | undefined;
    parent: string | undefined;
    glibTypeName: string | undefined;
    glibGetType: string | undefined;
    glibTypeStruct: string | undefined;
    glibRefFunc: string | undefined;
    glibUnrefFunc: string | undefined;
    fundamental: boolean;
    isInterface: boolean;
    introspectable: boolean;
    implements: string[];
    prerequisites: string[];
    methods: GirFunction[];
    constructors: GirFunction[];
    functions: GirFunction[];
    properties: GirProperty[];
    signals: GirSignal[];
};

export const classFromNode = (node: RawNode, isInterface: boolean, context: ParseContext): GirClass => ({
    name: nameAttr(node),
    doc: docOf(node),
    cType: attr(node, "c:type"),
    parent: attr(node, "parent"),
    glibTypeName: attr(node, "glib:type-name"),
    glibGetType: attr(node, "glib:get-type"),
    glibTypeStruct: attr(node, "glib:type-struct"),
    glibRefFunc: attr(node, "glib:ref-func"),
    glibUnrefFunc: attr(node, "glib:unref-func"),
    fundamental: attrBool(node, "glib:fundamental"),
    isInterface,
    introspectable: attrBool(node, "introspectable", true),
    implements: childrenOf(node, "implements")
        .map((implement) => attr(implement, "name"))
        .filter((name): name is string => name !== undefined),
    prerequisites: childrenOf(node, "prerequisite")
        .map((prerequisite) => attr(prerequisite, "name"))
        .filter((name): name is string => name !== undefined),
    methods: childrenOf(node, "method").map((method) => functionFromNode(method, context)),
    constructors: childrenOf(node, GIR_CONSTRUCTOR_TAG).map((ctor) => functionFromNode(ctor, context)),
    functions: childrenOf(node, "function").map((function_) => functionFromNode(function_, context)),
    properties: childrenOf(node, "property").map((property) => propertyFromNode(property, context)),
    signals: childrenOf(node, "glib:signal").map((signal) => parseCallable(signal, context)),
});
