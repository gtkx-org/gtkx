import { type ParameterTransfer, transferOwnership } from "./parameter.js";
import { attr, attrBool, nameAttr, type RawNode } from "./parse.js";
import type { ParseContext, TypeId } from "./type-id.js";
import { typeRefFromNode } from "./type-ref.js";

export type GirProperty = {
    name: string;
    type: TypeId | undefined;
    readable: boolean;
    writable: boolean;
    construct: boolean;
    constructOnly: boolean;
    introspectable: boolean;
    transferOwnership: ParameterTransfer;
    getter: string | undefined;
    setter: string | undefined;
    defaultValue: string | undefined;
};

export const isConstructableProperty = (property: GirProperty): boolean =>
    property.writable || property.construct || property.constructOnly;

export const propertyFromNode = (node: RawNode, context: ParseContext): GirProperty => ({
    name: nameAttr(node),
    type: typeRefFromNode(node, context),
    readable: attrBool(node, "readable", true),
    writable: attrBool(node, "writable"),
    construct: attrBool(node, "construct"),
    constructOnly: attrBool(node, "construct-only"),
    introspectable: attrBool(node, "introspectable", true),
    transferOwnership: transferOwnership(node),
    getter: attr(node, "getter"),
    setter: attr(node, "setter"),
    defaultValue: attr(node, "default-value"),
});
