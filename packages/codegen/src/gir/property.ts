import type { ParseContext, TypeId } from "./type-id.js";
import { type ParameterTransfer, transferOwnership } from "./parameter.js";
import { attr, getDoc, isAttrTrue, nameAttr, type RawNode } from "./parse.js";
import { typeRefFromNode } from "./type-ref.js";

type GirProperty = {
    name: string;
    doc: string | undefined;
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

const isConstructableProperty = (property: GirProperty): boolean =>
    property.writable || property.construct || property.constructOnly;

const propertyFromNode = (node: RawNode, context: ParseContext): GirProperty => ({
    name: nameAttr(node),
    doc: getDoc(node),
    type: typeRefFromNode(node, context),
    readable: isAttrTrue(node, "readable", true),
    writable: isAttrTrue(node, "writable"),
    construct: isAttrTrue(node, "construct"),
    constructOnly: isAttrTrue(node, "construct-only"),
    introspectable: isAttrTrue(node, "introspectable", true),
    transferOwnership: transferOwnership(node),
    getter: attr(node, "getter"),
    setter: attr(node, "setter"),
    defaultValue: attr(node, "default-value"),
});

export { isConstructableProperty, propertyFromNode, type GirProperty };
