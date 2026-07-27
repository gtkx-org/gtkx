import type { ParseContext, TypeId } from "./type-id.js";
import { attr, getChild, getDoc, intAttr, isAttrTrue, nameAttr, type RawNode } from "./parse.js";
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
});

export { fieldFromNode, type GirField };
