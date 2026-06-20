import { attr, childOf, childrenOf, intAttr, nameAttr, type RawNode } from "./parse.js";
import { primitiveCategory } from "./primitives.js";
import { type CArrayType, LIST_FLAVOR_BY_NAME, type ListFlavor, type ParseContext, type TypeId } from "./type-id.js";

const LIST_FLAVOR_BY_NAME_LOOKUP: ReadonlyMap<string, ListFlavor> = new Map(Object.entries(LIST_FLAVOR_BY_NAME));

/**
 * Interns the element type of a list-like or array node from its first `<type>`
 * child, falling back to an opaque pointer when the element is unannotated.
 */
const elementRefOf = (node: RawNode, context: ParseContext): TypeId => {
    const elementNode = childOf(node, "type");
    return elementNode === undefined ? pointerFallback(context) : typeRefFromTypeNode(elementNode, context);
};

/**
 * Interns the type slot of a parent XML node whose first `<type>`, `<array>`,
 * `<varargs>`, or `<callback>` child describes it, returning the {@link TypeId}
 * handle or `undefined` when no type slot exists.
 *
 * Pass the parent (`<parameter>`, `<return-value>`, `<field>`, `<property>`,
 * `<constant>`, `<alias>`). Resolution into a concrete entity happens later
 * through {@link GirRepository.typeOf}; the namespace is already baked into the
 * returned handle.
 *
 * @param parent - The element whose typed slot we are inspecting
 * @param context - The per-namespace interning seam
 */
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

/**
 * Interns a `<type>` element: a recognised GLib container routes to the
 * dedicated branch, a primitive interns into the internal namespace, and any
 * other name resolves-or-stubs against the surrounding namespace.
 *
 * @param typeNode - A `<type>` element
 * @param context - The per-namespace interning seam
 */
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

/**
 * Splits a possibly cross-namespace GIR identifier into its namespace and local
 * name, reporting an absent namespace as `undefined` so callers can apply their
 * own default. `splitOptionalNamespace("Gtk.Widget")` is `["Gtk", "Widget"]`
 * and `splitOptionalNamespace("Widget")` is `[undefined, "Widget"]`.
 */
export const splitOptionalNamespace = (name: string): readonly [string | undefined, string] => {
    const dot = name.indexOf(".");
    if (dot === -1) return [undefined, name];
    return [name.slice(0, dot), name.slice(dot + 1)];
};
