import type { Type } from "@gtkx/native";
import type { NativeClass } from "./handles.js";

/**
 * Construction metadata describing how a single boxed field is marshalled
 * into native memory after `g_malloc0`.
 *
 * When `bitWidth` is set the field is a C bitfield: `offset` addresses its
 * shared storage unit and the value is merged in at `bitOffset` rather than
 * written directly.
 */
export type BoxedFieldMeta = {
    /** Byte offset within the struct. */
    offset: number;
    /** FFI type descriptor used by {@link write}. */
    ffiType: Type;
    /** Bit position within the storage unit, for bitfield members. */
    bitOffset?: number;
    /** Width in bits, for bitfield members. */
    bitWidth?: number;
};

/**
 * Construction metadata for a boxed value type.
 *
 * Boxed records have no GType dependency in their construction path, so this
 * shape is shared verbatim between the registration descriptor and the stored
 * {@link ConstructionMeta}.
 */
export type BoxedConstructionMeta = {
    kind: "boxed";
    /** Struct size in bytes. */
    size: number;
    /** Optional GLib type name used by the boxed allocator. */
    glibTypeName?: string;
    /** Optional shared library hosting the boxed type. */
    lib?: string;
    /** Writable fields keyed by their JavaScript name. */
    fields: Record<string, BoxedFieldMeta>;
};

/**
 * Construction metadata as supplied to `registerNativeClass`.
 *
 * Only boxed value types carry construction metadata: their field layout
 * cannot be introspected at runtime. GObject classes construct through their
 * generated constructors instead, which translate typed props into `GValue`s
 * and hand them to the canonical `constructGObjectInstance`.
 */
export type ConstructionDescriptor = BoxedConstructionMeta;

/**
 * Metadata describing how to construct a registered boxed type.
 *
 * One entry per boxed record is registered in {@link CONSTRUCTION_META}
 * at module load via {@link registerConstructionMeta}. The generated boxed
 * constructor consults this registry through `constructNativeObject`.
 */
export type ConstructionMeta = BoxedConstructionMeta;

/**
 * Global registry of construction metadata keyed by the wrapper class.
 *
 * Populated at module load by each generated boxed binding via
 * {@link registerConstructionMeta} and consumed by `constructNativeObject`.
 */
export const CONSTRUCTION_META = new WeakMap<NativeClass, ConstructionMeta>();

/**
 * Registers construction metadata for a generated class.
 *
 * Called once per class at module-load time. Subsequent calls for the same
 * class overwrite the previous entry.
 *
 * @param cls - The wrapper class
 * @param meta - Construction metadata
 */
export function registerConstructionMeta(cls: NativeClass, meta: ConstructionMeta): void {
    CONSTRUCTION_META.set(cls, meta);
}
