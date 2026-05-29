import { attr, attrBool, childOf, childrenOf, type RawNode } from "./parse.js";
import { type PrimitiveCategory, primitiveCategory } from "./primitives.js";

/**
 * Lazily-resolved reference to a GIR type as it appears in a `<type>` or
 * `<array>` slot.
 *
 * The reference captures everything the writers need at emission time
 * without forcing entity resolution to happen at parse time (which would
 * impose a topological-sort order on namespace loading). Resolution into a
 * concrete `GirClass` / `GirBoxed` / `GirEnum` / … is performed on demand
 * by the writers via `GirRepository.resolveNamed`.
 */
export type GirTypeRef =
    | PrimitiveTypeRef
    | NamedTypeRef
    | ArrayTypeRef
    | ListTypeRef
    | HashTableTypeRef
    | InlineCallbackTypeRef
    | VarargsTypeRef;

/** A GIR scalar primitive: `gint`, `gboolean`, `utf8`, `gpointer`, etc. */
export type PrimitiveTypeRef = {
    readonly kind: "primitive";
    readonly category: PrimitiveCategory;
    readonly cType: string | undefined;
};

/**
 * A named type that resolves to a class, interface, boxed, enum, alias, or
 * fundamental in some namespace.
 *
 * `namespaceName` is the namespace prefix from the GIR (`"GLib"`, `"Gtk"`,
 * …) or `undefined` for an unqualified reference. The unqualified form
 * implies "look in the namespace the reference appears in".
 */
export type NamedTypeRef = {
    readonly kind: "named";
    readonly namespaceName: string | undefined;
    readonly typeName: string;
    readonly cType: string | undefined;
};

/** A C array (`<array>`) with optional length, fixed-size, or zero-terminated metadata. */
export type ArrayTypeRef = {
    readonly kind: "array";
    readonly element: GirTypeRef;
    readonly cType: string | undefined;
    readonly lengthParameterIndex: number | undefined;
    readonly fixedSize: number | undefined;
    readonly zeroTerminated: boolean;
};

/** A GLib `GList` / `GSList` / `GPtrArray` / `GArray` / `GByteArray`. */
export type ListTypeRef = {
    readonly kind: "list";
    readonly flavor: "glist" | "gslist" | "gptrarray" | "garray" | "gbytearray";
    readonly element: GirTypeRef;
    readonly cType: string | undefined;
};

/** A GLib `GHashTable` with key and value element types. */
export type HashTableTypeRef = {
    readonly kind: "hashtable";
    readonly key: GirTypeRef;
    readonly value: GirTypeRef;
    readonly cType: string | undefined;
};

/** An inline `<callback>` (used for vtable slots and callback parameters). */
export type InlineCallbackTypeRef = {
    readonly kind: "callback";
    readonly callback: RawNode;
};

/** A `<varargs/>` parameter placeholder; not marshalable. */
export type VarargsTypeRef = { readonly kind: "varargs" };

const LIST_KIND_BY_NAME: ReadonlyMap<string, "glist" | "gslist" | "gptrarray" | "garray" | "gbytearray"> = new Map([
    ["GLib.List", "glist"],
    ["GLib.SList", "gslist"],
    ["GLib.PtrArray", "gptrarray"],
    ["GLib.Array", "garray"],
    ["GLib.ByteArray", "gbytearray"],
] as const);

/**
 * Builds a {@link GirTypeRef} from a parent XML node whose first `<type>`,
 * `<array>`, or `<varargs>` child describes the slot.
 *
 * Pass the parent (`<parameter>`, `<return-value>`, `<field>`, `<property>`,
 * `<constant>`, `<alias>`). The helper extracts the right child and routes
 * to {@link typeRefFromTypeNode}.
 *
 * @param parent - The element whose typed slot we are inspecting
 * @returns The reference, or `undefined` if no type slot exists
 */
export const typeRefFromSlot = (parent: RawNode | undefined): GirTypeRef | undefined => {
    if (parent === undefined) return undefined;
    if (childOf(parent, "varargs") !== undefined) return { kind: "varargs" };
    const arrayNode = childOf(parent, "array");
    if (arrayNode !== undefined) return arrayTypeRefFromNode(arrayNode);
    const typeNode = childOf(parent, "type");
    if (typeNode !== undefined) return typeRefFromTypeNode(typeNode);
    const callback = childOf(parent, "callback");
    if (callback !== undefined) return { kind: "callback", callback };
    return undefined;
};

/**
 * Builds a {@link GirTypeRef} from a `<type>` element.
 *
 * Splits a `Namespace.TypeName` form into namespace + type, recognises GLib
 * container types (`GLib.List`, `GLib.HashTable`, …) by name and routes
 * them to the dedicated branches, otherwise produces a primitive or named
 * reference for later resolution.
 *
 * @param typeNode - A `<type>` element
 */
export const typeRefFromTypeNode = (typeNode: RawNode): GirTypeRef => {
    const name = attr(typeNode, "name") ?? "";
    const cType = attr(typeNode, "c:type");

    const listFlavor = LIST_KIND_BY_NAME.get(name);
    if (listFlavor !== undefined) {
        const elementNode = childOf(typeNode, "type");
        const element = elementNode === undefined ? pointerFallback() : typeRefFromTypeNode(elementNode);
        return { kind: "list", flavor: listFlavor, element, cType };
    }

    if (name === "GLib.HashTable") {
        const elementTypes = childrenOf(typeNode, "type");
        const keyNode = elementTypes[0];
        const valueNode = elementTypes[1];
        return {
            kind: "hashtable",
            key: keyNode === undefined ? pointerFallback() : typeRefFromTypeNode(keyNode),
            value: valueNode === undefined ? pointerFallback() : typeRefFromTypeNode(valueNode),
            cType,
        };
    }

    const primitive = primitiveCategory(name);
    if (primitive !== undefined) {
        return { kind: "primitive", category: primitive, cType };
    }

    const [namespaceName, typeName] = splitOptionalNamespace(name);
    return { kind: "named", namespaceName, typeName, cType };
};

const arrayTypeRefFromNode = (arrayNode: RawNode): ArrayTypeRef | ListTypeRef => {
    const elementNode = childOf(arrayNode, "type");
    const element: GirTypeRef = elementNode === undefined ? pointerFallback() : typeRefFromTypeNode(elementNode);
    const cType = attr(arrayNode, "c:type");
    const arrayName = attr(arrayNode, "name");
    const listFlavor = arrayName === undefined ? undefined : LIST_KIND_BY_NAME.get(arrayName);
    if (listFlavor !== undefined) {
        return { kind: "list", flavor: listFlavor, element, cType };
    }
    const lengthAttr = attr(arrayNode, "length");
    const fixedSizeAttr = attr(arrayNode, "fixed-size");
    return {
        kind: "array",
        element,
        cType,
        lengthParameterIndex: lengthAttr === undefined ? undefined : Number.parseInt(lengthAttr, 10),
        fixedSize: fixedSizeAttr === undefined ? undefined : Number.parseInt(fixedSizeAttr, 10),
        zeroTerminated: attrBool(arrayNode, "zero-terminated", false),
    };
};

const pointerFallback = (): PrimitiveTypeRef => ({ kind: "primitive", category: "pointer", cType: undefined });

const splitOptionalNamespace = (name: string): [string | undefined, string] => {
    const dot = name.indexOf(".");
    if (dot === -1) return [undefined, name];
    return [name.slice(0, dot), name.slice(dot + 1)];
};
