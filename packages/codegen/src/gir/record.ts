import type { ParseContext } from "./type-id.js";
import { documentedFromNode, type GirAnnotations } from "./annotations.js";
import { collectFields, type GirField } from "./field.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { attr, getChildren, GIR_CONSTRUCTOR_TAG, isAttrTrue, type RawNode } from "./parse.js";

type GirRecord = {
    isVtable: boolean;
    name: string;
    doc: string | undefined;
    annotations: GirAnnotations;
    cType: string | undefined;
    glibTypeName: string | undefined;
    glibGetType: string | undefined;
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
    ...documentedFromNode(node),
    name: attr(node, "name") ?? attr(node, "glib:name") ?? "",
    cType: attr(node, "c:type"),
    glibTypeName: attr(node, "glib:type-name"),
    glibGetType: attr(node, "glib:get-type"),
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

const INTERN_GTYPE = "intern";

const isInternRecord = (record: GirRecord): boolean => record.glibGetType === INTERN_GTYPE;

const isBoxedRecord = (record: GirRecord): record is GirRecord & { glibGetType: string } =>
    record.glibGetType !== undefined && !isInternRecord(record);

export { recordFromNode, isVtableRecord, isBoxedRecord, isInternRecord, type GirRecord };
