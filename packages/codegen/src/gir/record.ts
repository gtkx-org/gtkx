import { fieldFromNode, type GirField } from "./field.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { attr, attrBool, childrenOf, GIR_CONSTRUCTOR_TAG, type RawNode } from "./parse.js";
import type { ParseContext } from "./type-id.js";

export type GirRecord = {
    isVtable: boolean;
    name: string;
    cType: string | undefined;
    glibTypeName: string | undefined;
    glibGetType: string | undefined;
    glibRefFunc: string | undefined;
    glibUnrefFunc: string | undefined;
    copyFunc: string | undefined;
    freeFunc: string | undefined;
    disguised: boolean;
    opaque: boolean;
    introspectable: boolean;
    fields: GirField[];
    methods: GirFunction[];
    constructors: GirFunction[];
    functions: GirFunction[];
    isUnion: boolean;
};

export const recordFromNode = (
    node: RawNode,
    isVtable: boolean,
    isUnion: boolean,
    context: ParseContext,
): GirRecord => ({
    isVtable,
    name: attr(node, "name") ?? attr(node, "glib:name") ?? "",
    cType: attr(node, "c:type"),
    glibTypeName: attr(node, "glib:type-name"),
    glibGetType: attr(node, "glib:get-type"),
    glibRefFunc: attr(node, "glib:ref-func"),
    glibUnrefFunc: attr(node, "glib:unref-func"),
    copyFunc: attr(node, "copy-function"),
    freeFunc: attr(node, "free-function"),
    disguised: attrBool(node, "disguised"),
    opaque: attrBool(node, "opaque"),
    introspectable: attrBool(node, "introspectable", true),
    fields: childrenOf(node, "field").map((field) => fieldFromNode(field, context)),
    methods: childrenOf(node, "method").map((method) => functionFromNode(method, context)),
    constructors: childrenOf(node, GIR_CONSTRUCTOR_TAG).map((ctor) => functionFromNode(ctor, context)),
    functions: childrenOf(node, "function").map((function_) => functionFromNode(function_, context)),
    isUnion,
});

export const isVtableRecord = (node: RawNode): boolean => attr(node, "glib:is-gtype-struct-for") !== undefined;
