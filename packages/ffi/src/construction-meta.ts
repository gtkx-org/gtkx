import type { Type } from "@gtkx/native";
import type { NativeClass } from "./handles.js";

/**
 * Construction metadata describing how a single property is marshalled
 * into a `GValue` passed to `g_object_new_with_properties`.
 */
export type GObjectPropMeta = {
    /** GIR property name in dashed form (e.g. `"label"`, `"use-markup"`). */
    girName: string;
    /** FFI type descriptor used to build the `GValue`. */
    ffiType: Type;
    /** When `true`, the property is set only at construction time. */
    constructOnly?: true;
};

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
 * The GObject arm carries no `gtype` — the runtime resolves the descriptor's
 * shared GType once and injects the value when storing the {@link ConstructionMeta}.
 */
export type ConstructionDescriptor =
    | {
          kind: "gobject";
          /** Writable / construct properties declared by this class only. */
          props: Record<string, GObjectPropMeta>;
      }
    | BoxedConstructionMeta;

/**
 * Metadata describing how to construct a registered native type.
 *
 * One entry per concrete class is registered in {@link CONSTRUCTION_META}
 * at module load via {@link registerConstructionMeta}. The constructor on
 * `NativeObject` consults this registry to dispatch construction.
 */
export type ConstructionMeta =
    | {
          kind: "gobject";
          /** Runtime GType of the class, resolved once at registration. */
          gtype: number;
          /** Writable / construct properties declared by this class only. */
          props: Record<string, GObjectPropMeta>;
      }
    | BoxedConstructionMeta;

/**
 * Global registry of construction metadata keyed by the wrapper class.
 *
 * Populated at module load by each generated binding via
 * {@link registerConstructionMeta}. Consumed by `NativeObject`'s constructor
 * (which walks the JS prototype chain to merge inherited GObject props) and
 * by the `@gtkx/react` reconciler.
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
