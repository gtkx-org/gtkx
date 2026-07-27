import type { ParseContext } from "./type-id.js";
import { collectFields, type GirField } from "./field.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { attr, getChildren, getDoc, GIR_CONSTRUCTOR_TAG, isAttrTrue, type RawNode } from "./parse.js";

type GirRecord = {
    isVtable: boolean;
    name: string;
    doc: string | undefined;
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

const recordFromNode = (
    node: RawNode,
    isVtable: boolean,
    isUnion: boolean,
    context: ParseContext,
): GirRecord => ({
    isVtable,
    name: attr(node, "name") ?? attr(node, "glib:name") ?? "",
    doc: getDoc(node),
    cType: attr(node, "c:type"),
    glibTypeName: attr(node, "glib:type-name"),
    glibGetType: attr(node, "glib:get-type"),
    glibRefFunc: attr(node, "glib:ref-func"),
    glibUnrefFunc: attr(node, "glib:unref-func"),
    copyFunc: attr(node, "copy-function"),
    freeFunc: attr(node, "free-function"),
    disguised: isAttrTrue(node, "disguised"),
    opaque: isAttrTrue(node, "opaque"),
    introspectable: isAttrTrue(node, "introspectable", true),
    fields: collectFields(node, context),
    methods: getChildren(node, "method").map((method) => functionFromNode(method, context)),
    constructors: getChildren(node, GIR_CONSTRUCTOR_TAG).map((ctor) => functionFromNode(ctor, context)),
    functions: getChildren(node, "function").map((fn) => functionFromNode(fn, context)),
    isUnion,
});

const isVtableRecord = (node: RawNode): boolean => attr(node, "glib:is-gtype-struct-for") !== undefined;

export { recordFromNode, isVtableRecord, type GirRecord };
