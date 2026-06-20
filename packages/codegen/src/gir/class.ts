import { fieldFromNode, type GirField } from "./field.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { attr, attrBool, childrenOf, GIR_CONSTRUCTOR_TAG, nameAttr, type RawNode } from "./parse.js";
import { type GirProperty, propertyFromNode } from "./property.js";
import { type GirSignal, signalFromNode } from "./signal.js";
import type { ParseContext } from "./type-id.js";

export type GirClass = {
    name: string;
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
    fields: GirField[];
};

export const classFromNode = (node: RawNode, isInterface: boolean, context: ParseContext): GirClass => ({
    name: nameAttr(node),
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
    methods: childrenOf(node, "method").map((method) => functionFromNode(method, "method", context)),
    constructors: childrenOf(node, GIR_CONSTRUCTOR_TAG).map((ctor) => functionFromNode(ctor, "constructor", context)),
    functions: childrenOf(node, "function").map((function_) => functionFromNode(function_, "function", context)),
    properties: childrenOf(node, "property").map((property) => propertyFromNode(property, context)),
    signals: childrenOf(node, "glib:signal").map((signal) => signalFromNode(signal, context)),
    fields: childrenOf(node, "field").map((field) => fieldFromNode(field, context)),
});
