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

import { t } from "./helpers.js";

/**
 * A GLib type identifier — the `GType` integer the GObject type system
 * assigns to every registered class, interface, boxed, and fundamental type.
 *
 * Hand-declared here rather than imported from the generated bindings so the
 * runtime type layer stays independent of generated code.
 */
export type GType = number;

/**
 * Shared-object name of libgobject, home of every `g_type_*`, `g_value_*`,
 * and `g_object_*` symbol bound across the runtime and value layer.
 */
export const LIBGOBJECT = "libgobject-2.0.so.0";

/** Size of a `GValue` struct in bytes — a fixed GObject ABI fact. */
export const GVALUE_SIZE = 24;

/**
 * FFI descriptor for a borrowed `GValue` pointer argument: the shape every
 * `g_value_*` and `g_object_*_property` call passes for a `GValue *` whose
 * ownership stays with the caller.
 */
export const GVALUE_BORROWED = t.boxed("GValue", "borrowed", LIBGOBJECT, "g_value_get_type");

/**
 * The invalid GType sentinel (`G_TYPE_INVALID`), the numeric `0` the GObject
 * type system reserves for "no type". Returned by type-resolution helpers
 * when a class, parent, or instance has no associated GType.
 */
export const G_TYPE_INVALID: GType = 0;

/**
 * Narrows a marshaled FFI result to a `GType`.
 *
 * A `g_*_get_type` FFI call yields its numeric `gsize` as an untyped
 * marshaled value; this helper coerces it to a number and brands it as the
 * `GType` it is at runtime. It is the single sanctioned conversion point
 * from a raw FFI result to a `GType`.
 *
 * @param value - The marshaled FFI result of a type-resolution call.
 * @returns The result as a `GType`.
 */
export const gtypeFromFfi: (value: unknown) => GType = Number;

const g_type_from_name = t.fn(LIBGOBJECT, "g_type_from_name", [{ type: t.string("borrowed") }], t.uint64);

const g_type_is_a = t.fn(LIBGOBJECT, "g_type_is_a", [{ type: t.uint64 }, { type: t.uint64 }], t.boolean);

const g_type_parent = t.fn(LIBGOBJECT, "g_type_parent", [{ type: t.uint64 }], t.uint64);

const g_type_interfaces = t.fn(
    LIBGOBJECT,
    "g_type_interfaces",
    [{ type: t.uint64 }, { type: t.ref(t.uint32) }],
    t.sizedArray(t.uint64, 1, "full"),
);

const g_type_fundamental = t.fn(LIBGOBJECT, "g_type_fundamental", [{ type: t.uint64 }], t.uint64);

const g_type_name = t.fn(LIBGOBJECT, "g_type_name", [{ type: t.uint64 }], t.string("borrowed"));

/**
 * Tests whether `type` is a descendant of `isAType`, or — when `isAType` is
 * an interface — whether `type` conforms to it.
 *
 * @param type - The GType to test
 * @param isAType - The ancestor class or interface GType
 */
export function typeIsA(type: GType, isAType: GType): boolean {
    return g_type_is_a(type, isAType) as boolean;
}

/**
 * Returns the direct parent type of `type`, or the invalid GType (`0`) when
 * `type` has no parent.
 *
 * @param type - The GType whose parent to resolve
 */
export function typeParent(type: GType): GType {
    return g_type_parent(type) as GType;
}

/**
 * Returns the interface types that `type` and its ancestors implement.
 *
 * @param type - The GType whose implemented interfaces to enumerate
 */
export function typeInterfaces(type: GType): GType[] {
    const nInterfacesRef = { value: 0 };
    return g_type_interfaces(type, nInterfacesRef) as GType[];
}

/**
 * Resolves the runtime `GType` registered under the GLib type name `name`,
 * or the invalid GType (`0`) when no type has been registered with that name
 * — equivalent to a direct call to `g_type_from_name`.
 *
 * @param name - GLib type name (e.g. `"GtkButton"`)
 */
export function typeFromName(name: string): GType {
    return g_type_from_name(name) as GType;
}

/**
 * Returns the fundamental `GType` that `type` derives from — the
 * `G_TYPE_FUNDAMENTAL` C macro. Boxed, enum, flags, object, and the like all
 * collapse onto their shared fundamental, which the value marshaller keys on.
 *
 * @param type - The GType whose fundamental to resolve
 */
export function typeFundamental(type: GType): GType {
    return g_type_fundamental(type) as GType;
}

/**
 * Returns the GLib type name registered for `type`, or `null` when `type` has
 * no registered name — equivalent to the `g_type_name` C function.
 *
 * @param type - The GType whose name to resolve
 */
export function typeName(type: GType): string | null {
    return (g_type_name(type) as string | null) ?? null;
}
