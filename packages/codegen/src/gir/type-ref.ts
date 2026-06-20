import { attr, childOf, childrenOf, intAttr, nameAttr, type RawNode } from "./parse.js";
import { primitiveCategory } from "./primitives.js";
import { type CArrayType, LIST_FLAVOR_BY_NAME, type ListFlavor, type ParseContext, type TypeId } from "./type-id.js";

const LIST_FLAVOR_BY_NAME_LOOKUP: Map<string, ListFlavor> = new Map(Object.entries(LIST_FLAVOR_BY_NAME));

const elementRefOf = (node: RawNode, context: ParseContext): TypeId => {
    const elementNode = childOf(node, "type");
    return elementNode === undefined ? pointerFallback(context) : typeRefFromTypeNode(elementNode, context);
};

export const typeRefFromSlot = (parent: RawNode | undefined, context: ParseContext): TypeId | undefined => {
    if (parent === undefined) return undefined;
    if (childOf(parent, "varargs") !== undefined) return context.internVarargs();
    const arrayNode = childOf(parent, "array");
    if (arrayNode !== undefined) return arrayTypeRefFromNode(arrayNode, context);
    const typeNode = childOf(parent, "type");
    if (typeNode !== undefined) return typeRefFromTypeNode(typeNode, context);
    const callback = childOf(parent, "callback");
    if (callback !== undefined) return context.internInlineCallback(callback);
    return undefined;
};

const typeRefFromTypeNode = (typeNode: RawNode, context: ParseContext): TypeId => {
    const name = nameAttr(typeNode);

    const listFlavor = LIST_FLAVOR_BY_NAME_LOOKUP.get(name);
    if (listFlavor !== undefined) {
        return context.internContainer({ kind: "list", flavor: listFlavor, element: elementRefOf(typeNode, context) });
    }

    if (name === "GLib.HashTable") {
        const elementTypes = childrenOf(typeNode, "type");
        const keyNode = elementTypes[0];
        const valueNode = elementTypes[1];
        return context.internContainer({
            kind: "hashtable",
            key: keyNode === undefined ? pointerFallback(context) : typeRefFromTypeNode(keyNode, context),
            value: valueNode === undefined ? pointerFallback(context) : typeRefFromTypeNode(valueNode, context),
        });
    }

    const primitive = primitiveCategory(name);
    if (primitive !== undefined) {
        return context.internPrimitive(primitive);
    }

    return context.findOrStubType(name);
};

const arrayTypeRefFromNode = (arrayNode: RawNode, context: ParseContext): TypeId => {
    const element = elementRefOf(arrayNode, context);
    const arrayName = attr(arrayNode, "name");
    const listFlavor = arrayName === undefined ? undefined : LIST_FLAVOR_BY_NAME_LOOKUP.get(arrayName);
    if (listFlavor !== undefined) {
        return context.internContainer({ kind: "list", flavor: listFlavor, element });
    }
    const elementNode = childOf(arrayNode, "type");
    const carray: CArrayType = {
        kind: "carray",
        element,
        elementCType: elementNode === undefined ? undefined : attr(elementNode, "c:type"),
        lengthParameterIndex: intAttr(arrayNode, "length"),
        fixedSize: intAttr(arrayNode, "fixed-size"),
    };
    return context.internContainer(carray);
};

const pointerFallback = (context: ParseContext): TypeId => context.internPrimitive("pointer");

export const splitOptionalNamespace = (name: string): [string | undefined, string] => {
    const dot = name.indexOf(".");
    if (dot === -1) return [undefined, name];
    return [name.slice(0, dot), name.slice(dot + 1)];
};
