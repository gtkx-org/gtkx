import { attr, getChild, getChildren, intAttr, isAttrTrue, nameAttr, type RawNode } from "./parse.js";
import { primitiveCategory } from "./primitives.js";
import { type CArrayType, LIST_FLAVOR_BY_NAME, type ListFlavor, type ParseContext, type TypeId } from "./type-id.js";

const LIST_FLAVOR_BY_NAME_LOOKUP: Map<string, ListFlavor> = new Map(Object.entries(LIST_FLAVOR_BY_NAME));

const getElementRef = (node: RawNode, context: ParseContext): TypeId => {
    const elementNode = getChild(node, "type");

    return elementNode === undefined ? pointerFallback(context) : typeRefFromTypeNode(elementNode, context);
};

const typeRefFromNode = (parent: RawNode | undefined, context: ParseContext): TypeId | undefined => {
    if (parent === undefined) {
        return undefined;
    }

    if (getChild(parent, "varargs") !== undefined) {
        return context.addVarargs();
    }

    const arrayNode = getChild(parent, "array");

    if (arrayNode !== undefined) {
        return arrayTypeRefFromNode(arrayNode, context);
    }

    const typeNode = getChild(parent, "type");

    if (typeNode !== undefined) {
        return typeRefFromTypeNode(typeNode, context);
    }

    const callback = getChild(parent, "callback");

    if (callback !== undefined) {
        return context.addAnonymousCallback(callback);
    }

    return undefined;
};

const hashTableRefFromNode = (typeNode: RawNode, context: ParseContext): TypeId => {
    const elementTypes = getChildren(typeNode, "type");
    const keyNode = elementTypes[0];
    const valueNode = elementTypes[1];

    return context.addContainer({
        kind: "hashtable",
        key: keyNode === undefined ? pointerFallback(context) : typeRefFromTypeNode(keyNode, context),
        value: valueNode === undefined ? pointerFallback(context) : typeRefFromTypeNode(valueNode, context),
    });
};

const typeRefFromTypeNode = (typeNode: RawNode, context: ParseContext): TypeId => {
    const name = nameAttr(typeNode);
    const listFlavor = LIST_FLAVOR_BY_NAME_LOOKUP.get(name);

    if (listFlavor !== undefined) {
        return context.addContainer({ kind: "list", flavor: listFlavor, element: getElementRef(typeNode, context) });
    }

    if (name === "GLib.HashTable") {
        return hashTableRefFromNode(typeNode, context);
    }

    const primitive = primitiveCategory(name);

    if (primitive !== undefined) {
        return context.addPrimitive(primitive);
    }

    return context.findType(name);
};

const arrayTypeRefFromNode = (arrayNode: RawNode, context: ParseContext): TypeId => {
    const element = getElementRef(arrayNode, context);
    const arrayName = attr(arrayNode, "name");
    const listFlavor = arrayName === undefined ? undefined : LIST_FLAVOR_BY_NAME_LOOKUP.get(arrayName);

    if (listFlavor !== undefined) {
        return context.addContainer({ kind: "list", flavor: listFlavor, element });
    }

    const elementNode = getChild(arrayNode, "type");

    const carray: CArrayType = {
        kind: "carray",
        element,
        elementCType: elementNode === undefined ? undefined : attr(elementNode, "c:type"),
        lengthParameterIndex: intAttr(arrayNode, "length"),
        fixedSize: intAttr(arrayNode, "fixed-size"),
        zeroTerminated: isAttrTrue(arrayNode, "zero-terminated", true),
    };

    return context.addContainer(carray);
};

const pointerFallback = (context: ParseContext): TypeId => context.addPrimitive("pointer");

const splitOptionalNamespace = (name: string): [string | undefined, string] => {
    const dot = name.indexOf(".");

    if (dot === -1) {
        return [undefined, name];
    }

    return [name.slice(0, dot), name.slice(dot + 1)];
};

export { typeRefFromNode, splitOptionalNamespace };
