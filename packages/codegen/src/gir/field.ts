import type { ParseContext, TypeId } from "./type-id.js";
import { attr, getChild, getChildren, getDoc, intAttr, isAttrTrue, nameAttr, type RawNode } from "./parse.js";
import { typeRefFromNode } from "./type-ref.js";

type GirField = {
    name: string;
    doc: string | undefined;
    type: TypeId | undefined;
    cType: string | undefined;
    readable: boolean;
    writable: boolean;
    private: boolean;
    bits: number | undefined;
    inlineMembers: GirField[] | undefined;
    inlineIsUnion: boolean;
};

const fieldFromNode = (node: RawNode, context: ParseContext): GirField => ({
    name: nameAttr(node),
    doc: getDoc(node),
    type: typeRefFromNode(node, context),
    cType: attr(getChild(node, "type"), "c:type"),
    readable: isAttrTrue(node, "readable", true),
    writable: isAttrTrue(node, "writable", false),
    private: isAttrTrue(node, "private", false),
    bits: intAttr(node, "bits"),
    inlineMembers: undefined,
    inlineIsUnion: false,
});

const anonymousMemberFromNode = (node: RawNode, isUnion: boolean, context: ParseContext): GirField => ({
    name: nameAttr(node),
    doc: getDoc(node),
    type: undefined,
    cType: undefined,
    readable: false,
    writable: false,
    private: true,
    bits: undefined,
    inlineMembers: collectFields(node, context),
    inlineIsUnion: isUnion,
});

const collectFields = (node: RawNode, context: ParseContext): GirField[] => [
    ...getChildren(node, "field").map((field) => fieldFromNode(field, context)),
    ...getChildren(node, "union").map((member) => anonymousMemberFromNode(member, true, context)),
    ...getChildren(node, "record").map((member) => anonymousMemberFromNode(member, false, context)),
];

export { collectFields, fieldFromNode, type GirField };
