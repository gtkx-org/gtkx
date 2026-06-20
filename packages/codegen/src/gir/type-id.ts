import type { RawNode } from "./parse.js";
import type { PrimitiveCategory } from "./primitives.js";

/**
 * Stable handle to one interned {@link GirType} slot.
 *
 * `nsId` selects the namespace arena and `id` the slot inside it. A handle is
 * resolved through {@link GirRepository.typeOf}; because the namespace is baked
 * into the handle at parse time, resolution never re-derives a default
 * namespace and never re-splits a `Namespace.Type` string.
 */
export type TypeId = { readonly nsId: number; readonly id: number };

/** A GLib `GList` / `GSList` / `GPtrArray` / `GArray` / `GByteArray`. */
export type ListFlavor = "glist" | "gslist" | "gptrarray" | "garray" | "gbytearray";

/** A GIR scalar primitive: `gint`, `gboolean`, `utf8`, `gpointer`, etc. */
export type PrimitiveType = { readonly kind: "primitive"; readonly category: PrimitiveCategory };

/** A `<varargs/>` parameter placeholder; not marshalable. */
export type VarargsType = { readonly kind: "varargs" };

/** A C array (`<array>`) with optional length or fixed-size metadata. */
export type CArrayType = {
    readonly kind: "carray";
    readonly element: TypeId;
    /** The element's own `c:type`, kept for the inline-element-size pointer test. */
    readonly elementCType: string | undefined;
    readonly lengthParameterIndex: number | undefined;
    readonly fixedSize: number | undefined;
};

/** A GLib list-shaped container holding one element type. */
export type GListType = {
    readonly kind: "list";
    readonly flavor: ListFlavor;
    readonly element: TypeId;
};

/** A GLib `GHashTable` with key and value element types. */
export type GHashTableType = {
    readonly kind: "hashtable";
    readonly key: TypeId;
    readonly value: TypeId;
};

/**
 * The interned types that carry no reference to a GIR entity: primitives,
 * varargs, and the three container shapes (whose elements are themselves
 * {@link TypeId} handles). Kept free of entity imports so the parse layer can
 * build them without a module cycle.
 */
export type StructuralType = PrimitiveType | VarargsType | CArrayType | GListType | GHashTableType;

/**
 * Per-namespace interning seam handed to the parse layer.
 *
 * Bound to one namespace's `nsId`, it exposes exactly the interning a
 * `<type>`/`<array>`/`<callback>` slot needs: resolve-or-stub a named type,
 * intern a primitive/varargs/container, or eagerly parse and intern an inline
 * callback. The implementation lives on {@link GirRepository}; the parse layer
 * depends only on this interface, so `type-ref.ts` never imports the entity
 * modules.
 */
export type ParseContext = {
    /** The namespace whose entities are currently being parsed. */
    readonly nsId: number;
    /** Resolves `name` (optionally `Namespace.Name`) to a slot, stubbing it if unseen. */
    findOrStubType(name: string): TypeId;
    /** Interns a primitive, deduplicated in the internal namespace. */
    internPrimitive(category: PrimitiveCategory): TypeId;
    /** Interns the shared `<varargs/>` placeholder. */
    internVarargs(): TypeId;
    /** Interns one container occurrence as a fresh anonymous slot. */
    internContainer(type: CArrayType | GListType | GHashTableType): TypeId;
    /** Eagerly parses an inline `<callback>` and interns it as a fresh anonymous slot. */
    internInlineCallback(node: RawNode): TypeId;
};
