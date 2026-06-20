import { attr, childOf, childrenOf, type RawNode } from "./parse.js";
import { primitiveCategory } from "./primitives.js";
import type { CArrayType, ListFlavor, ParseContext, TypeId } from "./type-id.js";

const LIST_KIND_BY_NAME: ReadonlyMap<string, ListFlavor> = new Map([
    ["GLib.List", "glist"],
    ["GLib.SList", "gslist"],
    ["GLib.PtrArray", "gptrarray"],
    ["GLib.Array", "garray"],
    ["GLib.ByteArray", "gbytearray"],
] as const);

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
    const name = attr(typeNode, "name") ?? "";

    const listFlavor = LIST_KIND_BY_NAME.get(name);
    if (listFlavor !== undefined) {
        const elementNode = childOf(typeNode, "type");
        const element =
            elementNode === undefined ? pointerFallback(context) : typeRefFromTypeNode(elementNode, context);
        return context.internContainer({ kind: "list", flavor: listFlavor, element });
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
    const elementNode = childOf(arrayNode, "type");
    const element = elementNode === undefined ? pointerFallback(context) : typeRefFromTypeNode(elementNode, context);
    const arrayName = attr(arrayNode, "name");
    const listFlavor = arrayName === undefined ? undefined : LIST_KIND_BY_NAME.get(arrayName);
    if (listFlavor !== undefined) {
        return context.internContainer({ kind: "list", flavor: listFlavor, element });
    }
    const lengthAttr = attr(arrayNode, "length");
    const fixedSizeAttr = attr(arrayNode, "fixed-size");
    const carray: CArrayType = {
        kind: "carray",
        element,
        elementCType: elementNode === undefined ? undefined : attr(elementNode, "c:type"),
        lengthParameterIndex: lengthAttr === undefined ? undefined : Number.parseInt(lengthAttr, 10),
        fixedSize: fixedSizeAttr === undefined ? undefined : Number.parseInt(fixedSizeAttr, 10),
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
