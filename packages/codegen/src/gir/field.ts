import type { ParseContext, TypeId } from "./type-id.js";
import { documentedFromNode, type GirAnnotations } from "./annotations.js";
import { attr, getChild, getOrderedChildren, intAttr, isAttrTrue, type RawNode } from "./parse.js";
import { typeRefFromNode } from "./type-ref.js";

type GirField = {
    name: string;
    doc: string | undefined;
    annotations: GirAnnotations;
    type: TypeId | undefined;
    cType: string | undefined;
    readable: boolean;
    writable: boolean;
    private: boolean;
    introspectable: boolean;
    bits: number | undefined;
    inlineMembers: GirField[] | undefined;
    isInlineUnion: boolean;
};

const fieldFromNode = (node: RawNode, context: ParseContext): GirField => ({
    ...documentedFromNode(node),
    type: typeRefFromNode(node, context),
    cType: attr(getChild(node, "type"), "c:type"),
    readable: isAttrTrue(node, "readable", true),
    writable: isAttrTrue(node, "writable", false),
    private: isAttrTrue(node, "private", false),
    introspectable: isAttrTrue(node, "introspectable", true),
    bits: intAttr(node, "bits"),
    inlineMembers: undefined,
    isInlineUnion: false,
});

const anonymousMemberFromNode = (node: RawNode, isUnion: boolean, context: ParseContext): GirField => ({
    ...documentedFromNode(node),
    type: undefined,
    cType: undefined,
    readable: false,
    writable: false,
    private: true,
    introspectable: false,
    bits: undefined,
    inlineMembers: collectFields(node, context),
    isInlineUnion: isUnion,
});

const collectFields = (node: RawNode, context: ParseContext): GirField[] =>
    getOrderedChildren(node, ["field", "union", "record"]).map(({ tag, node: child }) =>
        tag === "field"
            ? fieldFromNode(child, context)
            : anonymousMemberFromNode(child, tag === "union", context));

export { collectFields, type GirField };
