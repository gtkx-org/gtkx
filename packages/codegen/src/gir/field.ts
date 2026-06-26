import { attr, attrBool, childOf, intAttr, nameAttr, type RawNode } from "./parse.js";
import type { ParseContext, TypeId } from "./type-id.js";
import { typeRefFromNode } from "./type-ref.js";

export type GirField = {
    name: string;
    type: TypeId | undefined;
    cType: string | undefined;
    readable: boolean;
    writable: boolean;
    private: boolean;
    bits: number | undefined;
};

export const fieldFromNode = (node: RawNode, context: ParseContext): GirField => ({
    name: nameAttr(node),
    type: typeRefFromNode(node, context),
    cType: attr(childOf(node, "type"), "c:type"),
    readable: attrBool(node, "readable", true),
    writable: attrBool(node, "writable", false),
    private: attrBool(node, "private", false),
    bits: intAttr(node, "bits"),
});
