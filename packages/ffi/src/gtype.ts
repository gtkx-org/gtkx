/**
 * Generated-code-independent access to the GObject type system.
 *
 * The runtime modules `registry.ts`, `register-class.ts`, and `native.ts`
 * need a handful of `g_type_*` functions for runtime type resolution.
 * Importing them from the generated `gobject` bindings would make the
 * runtime layer depend on generated code and close an import cycle through
 * the runtime barrel, leaving registration helpers undefined when generated
 * modules call them at load time. These hand-written FFI bindings keep the
 * runtime self-contained.
 */

import { LIBGOBJECT } from "./constants.js";
import { t } from "./descriptors.js";

/**
 * A GLib type identifier — the `GType` integer the GObject type system
 * assigns to every registered class, interface, boxed, and fundamental type.
 *
 * Hand-declared here rather than imported from the generated bindings so the
 * runtime type layer stays independent of generated code.
 */
export type GType = number;

/**
 * Structural shape of a wrapped native instance once construction or
 * `wrapHandle` has stamped its runtime GLib type onto it. Every GObject and
 * boxed wrapper produced by `@gtkx/ffi` satisfies it; consumers that need an
 * instance's runtime `GType` read it through this type.
 */
export type GTyped = {
    /** Runtime `GType` of the underlying GObject or boxed instance. */
    // biome-ignore lint/style/useNamingConvention: GObject phantom-type key read off instances
    readonly __gtype__: GType;
};

/**
 * Tests whether `value` is a wrapped native instance carrying a runtime
 * `GType` — an object exposing a numeric `__gtype__`.
 *
 * @param value - The value to test.
 * @returns `true` when `value` exposes a numeric `__gtype__`.
 */
export const isGtyped = (value: unknown): value is GTyped =>
    typeof value === "object" && value !== null && "__gtype__" in value && typeof value.__gtype__ === "number";

/**
 * Builds a resolver that looks a `GType` up by name on first call and caches the
 * result for every call thereafter.
 *
 * For a type whose `GType` is not available at module evaluation — a lazily
 * registered boxed type whose name the type system does not know until its
 * registration function has run — this defers the {@link typeFromName} lookup to
 * first use rather than module load.
 *
 * @param name - The GLib type name to resolve (e.g. `"GError"`).
 * @returns A function returning the cached `GType`.
 * @example
 * ```ts
 * const getErrorGtype = lazyGtype("GError");
 * const gtype = getErrorGtype();
 * ```
 */
export const lazyGtype = (name: string): (() => GType) => {
    let cached: GType | undefined;
    return () => {
        cached ??= typeFromName(name);
        return cached;
    };
};

const gTypeFromName = t.bind(LIBGOBJECT, "g_type_from_name", [t.string("borrowed")], t.uint64);
const gTypeIsA = t.bind(LIBGOBJECT, "g_type_is_a", [t.uint64, t.uint64], t.boolean);
const gTypeParent = t.bind(LIBGOBJECT, "g_type_parent", [t.uint64], t.uint64);
const gTypeFundamental = t.bind(LIBGOBJECT, "g_type_fundamental", [t.uint64], t.uint64);
const gTypeName = t.bind(LIBGOBJECT, "g_type_name", [t.uint64], t.string("borrowed"));

const gTypeInterfaces = t.bind(
    LIBGOBJECT,
    "g_type_interfaces",
    [t.uint64, t.ref(t.uint32)],
    t.sizedArray(t.uint64, 1, "full"),
);

/**
 * Tests whether `type` is a descendant of `isAType`, or — when `isAType` is
 * an interface — whether `type` conforms to it.
 *
 * @param type - The GType to test
 * @param isAType - The ancestor class or interface GType
 */
export function typeIsA(type: GType, isAType: GType): boolean {
    return gTypeIsA(type, isAType) as boolean;
}

/**
 * Returns the direct parent type of `type`, or the invalid GType (`0`) when
 * `type` has no parent.
 *
 * @param type - The GType whose parent to resolve
 */
export function typeParent(type: GType): GType {
    return gTypeParent(type) as GType;
}

/**
 * Returns the interface types that `type` and its ancestors implement.
 *
 * @param type - The GType whose implemented interfaces to enumerate
 */
export function typeInterfaces(type: GType): GType[] {
    const nInterfacesRef = { value: 0 };
    return gTypeInterfaces(type, nInterfacesRef) as GType[];
}

/**
 * Resolves the runtime `GType` registered under the GLib type name `name`,
 * or the invalid GType (`0`) when no type has been registered with that name
 * — equivalent to a direct call to `g_type_from_name`.
 *
 * @param name - GLib type name (e.g. `"GtkButton"`)
 */
export function typeFromName(name: string): GType {
    return gTypeFromName(name) as GType;
}

/**
 * Returns the fundamental `GType` that `type` derives from — the
 * `G_TYPE_FUNDAMENTAL` C macro. Boxed, enum, flags, object, and the like all
 * collapse onto their shared fundamental, which the value marshaller keys on.
 *
 * @param type - The GType whose fundamental to resolve
 */
export function typeFundamental(type: GType): GType {
    return gTypeFundamental(type) as GType;
}

/**
 * Returns the GLib type name registered for `type`, or `null` when `type` has
 * no registered name — equivalent to the `g_type_name` C function.
 *
 * @param type - The GType whose name to resolve
 */
export function typeName(type: GType): string | null {
    return (gTypeName(type) as string | null) ?? null;
}

/**
 * The invalid `GType` sentinel — the numeric `0` the GObject type system
 * reserves for "no type". Type-resolution helpers (`typeFromName`,
 * `typeParent`, …) return it when a class, parent, or instance has no
 * associated `GType`.
 */
export const TYPE_INVALID: GType = 0;

/**
 * The fundamental `GType` denoting the absence of a typed value.
 *
 * @public
 */
export const TYPE_NONE: GType = typeFromName("void");

/**
 * The fundamental `GType` from which all interface types are derived.
 */
export const TYPE_INTERFACE: GType = typeFromName("GInterface");

/**
 * The fundamental `GType` of a signed 8-bit integer (`gchar`).
 *
 * @public
 */
export const TYPE_CHAR: GType = typeFromName("gchar");

/**
 * The fundamental `GType` of an unsigned 8-bit integer (`guchar`).
 *
 * @public
 */
export const TYPE_UCHAR: GType = typeFromName("guchar");

/**
 * The fundamental `GType` of a boolean value.
 */
export const TYPE_BOOLEAN: GType = typeFromName("gboolean");

/**
 * The fundamental `GType` of a signed integer (`gint`).
 */
export const TYPE_INT: GType = typeFromName("gint");

/**
 * The fundamental `GType` of an unsigned integer (`guint`).
 */
export const TYPE_UINT: GType = typeFromName("guint");

/**
 * The fundamental `GType` of a signed long integer (`glong`).
 *
 * @public
 */
export const TYPE_LONG: GType = typeFromName("glong");

/**
 * The fundamental `GType` of an unsigned long integer (`gulong`).
 *
 * @public
 */
export const TYPE_ULONG: GType = typeFromName("gulong");

/**
 * The fundamental `GType` of a signed 64-bit integer (`gint64`).
 */
export const TYPE_INT64: GType = typeFromName("gint64");

/**
 * The fundamental `GType` of an unsigned 64-bit integer (`guint64`).
 */
export const TYPE_UINT64: GType = typeFromName("guint64");

/**
 * The fundamental `GType` from which all enumeration types are derived.
 */
export const TYPE_ENUM: GType = typeFromName("GEnum");

/**
 * The fundamental `GType` from which all flags types are derived.
 */
export const TYPE_FLAGS: GType = typeFromName("GFlags");

/**
 * The fundamental `GType` of a single-precision float (`gfloat`).
 */
export const TYPE_FLOAT: GType = typeFromName("gfloat");

/**
 * The fundamental `GType` of a double-precision float (`gdouble`).
 */
export const TYPE_DOUBLE: GType = typeFromName("gdouble");

/**
 * The fundamental `GType` of a string (`gchararray`).
 */
export const TYPE_STRING: GType = typeFromName("gchararray");

/**
 * The fundamental `GType` of an untyped pointer (`gpointer`).
 */
export const TYPE_POINTER: GType = typeFromName("gpointer");

/**
 * The fundamental `GType` from which all boxed types are derived.
 */
export const TYPE_BOXED: GType = typeFromName("GBoxed");

/**
 * The fundamental `GType` from which all `GParamSpec` types are derived.
 */
export const TYPE_PARAM: GType = typeFromName("GParam");

/**
 * The fundamental `GType` from which all `GObject` types are derived.
 */
export const TYPE_OBJECT: GType = typeFromName("GObject");

/**
 * The fundamental `GType` representing a `GType` identifier itself.
 *
 * @public
 */
export const TYPE_GTYPE: GType = typeFromName("GType");

/**
 * The fundamental `GType` of a `GVariant` value.
 */
export const TYPE_VARIANT: GType = typeFromName("GVariant");

/**
 * The fundamental `GType` of a Unicode code point, mapped to `guint`.
 *
 * @public
 */
export const TYPE_UNICHAR: GType = typeFromName("guint");

/**
 * Resolves and caches the boxed `GType` of a GLib `GError`.
 */
export const getErrorGtype: () => GType = lazyGtype("GError");
