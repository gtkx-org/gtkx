/**
 * Hand-written low-level `GValue` wrapper.
 *
 * Allocates and accesses a 24-byte `GValue` struct entirely through raw FFI
 * bindings, with no dependency on the generated `GObject.Value` class. This is
 * the value container the runtime marshalling layer (`./gvalue.js`,
 * `../value-marshal.js`) builds on, keeping `@gtkx/ffi` independent of
 * generated code.
 *
 * The public `GObject.Value` class is generated separately and wraps the same
 * struct; the two interoperate at the handle level (both are reached through
 * `getHandle`), so a value produced here can flow into any native call —
 * including `g_object_new_with_properties` — that expects a `GValue *`.
 */

import type { NativeHandle } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { type GType, GVALUE_BORROWED, GVALUE_SIZE, LIBGOBJECT } from "../gtype.js";
import { getHandle, setHandle, tryGetHandle } from "../handles.js";
import { alloc, t } from "../native.js";
import { getNativeObject } from "../registry.js";

const g_value_init = t.fn(LIBGOBJECT, "g_value_init", [{ type: GVALUE_BORROWED }, { type: t.uint64 }], t.void);
const g_value_set_pointer = t.fn(
    LIBGOBJECT,
    "g_value_set_pointer",
    [{ type: GVALUE_BORROWED }, { type: t.uint64 }],
    t.void,
);

/**
 * Stores `pointer`'s raw address as `value`'s `G_TYPE_POINTER` payload. `value`
 * must already be initialized to `G_TYPE_POINTER`; a handler reached through the
 * payload writes into the memory `pointer` references.
 *
 * Provided as a free function, not a {@link GValue} method, so the wrapper
 * stays a structural subset of the generated `GObject.Value`.
 *
 * @param value - The `G_TYPE_POINTER`-initialized value to populate.
 * @param pointer - Handle whose backing memory the payload points at.
 */
export const setGValuePointer = (value: GValue, pointer: NativeHandle): void => {
    g_value_set_pointer(getHandle(value), pointer);
};

const g_value_set_boolean = t.fn(
    LIBGOBJECT,
    "g_value_set_boolean",
    [{ type: GVALUE_BORROWED }, { type: t.boolean }],
    t.void,
);
const g_value_get_boolean = t.fn(LIBGOBJECT, "g_value_get_boolean", [{ type: GVALUE_BORROWED }], t.boolean);
const g_value_set_int = t.fn(LIBGOBJECT, "g_value_set_int", [{ type: GVALUE_BORROWED }, { type: t.int32 }], t.void);
const g_value_get_int = t.fn(LIBGOBJECT, "g_value_get_int", [{ type: GVALUE_BORROWED }], t.int32);
const g_value_set_uint = t.fn(LIBGOBJECT, "g_value_set_uint", [{ type: GVALUE_BORROWED }, { type: t.uint32 }], t.void);
const g_value_get_uint = t.fn(LIBGOBJECT, "g_value_get_uint", [{ type: GVALUE_BORROWED }], t.uint32);
const g_value_set_long = t.fn(LIBGOBJECT, "g_value_set_long", [{ type: GVALUE_BORROWED }, { type: t.int64 }], t.void);
const g_value_get_long = t.fn(LIBGOBJECT, "g_value_get_long", [{ type: GVALUE_BORROWED }], t.int64);
const g_value_set_ulong = t.fn(
    LIBGOBJECT,
    "g_value_set_ulong",
    [{ type: GVALUE_BORROWED }, { type: t.uint64 }],
    t.void,
);
const g_value_get_ulong = t.fn(LIBGOBJECT, "g_value_get_ulong", [{ type: GVALUE_BORROWED }], t.uint64);
const g_value_set_int64 = t.fn(LIBGOBJECT, "g_value_set_int64", [{ type: GVALUE_BORROWED }, { type: t.int64 }], t.void);
const g_value_get_int64 = t.fn(LIBGOBJECT, "g_value_get_int64", [{ type: GVALUE_BORROWED }], t.int64);
const g_value_set_uint64 = t.fn(
    LIBGOBJECT,
    "g_value_set_uint64",
    [{ type: GVALUE_BORROWED }, { type: t.uint64 }],
    t.void,
);
const g_value_get_uint64 = t.fn(LIBGOBJECT, "g_value_get_uint64", [{ type: GVALUE_BORROWED }], t.uint64);
const g_value_set_float = t.fn(
    LIBGOBJECT,
    "g_value_set_float",
    [{ type: GVALUE_BORROWED }, { type: t.float32 }],
    t.void,
);
const g_value_get_float = t.fn(LIBGOBJECT, "g_value_get_float", [{ type: GVALUE_BORROWED }], t.float32);
const g_value_set_double = t.fn(
    LIBGOBJECT,
    "g_value_set_double",
    [{ type: GVALUE_BORROWED }, { type: t.float64 }],
    t.void,
);
const g_value_get_double = t.fn(LIBGOBJECT, "g_value_get_double", [{ type: GVALUE_BORROWED }], t.float64);
const g_value_set_string = t.fn(
    LIBGOBJECT,
    "g_value_set_string",
    [{ type: GVALUE_BORROWED }, { type: t.string("borrowed"), optional: true }],
    t.void,
);
const g_value_get_string = t.fn(LIBGOBJECT, "g_value_get_string", [{ type: GVALUE_BORROWED }], t.string("borrowed"));
const g_value_set_schar = t.fn(LIBGOBJECT, "g_value_set_schar", [{ type: GVALUE_BORROWED }, { type: t.int8 }], t.void);
const g_value_get_schar = t.fn(LIBGOBJECT, "g_value_get_schar", [{ type: GVALUE_BORROWED }], t.int8);
const g_value_set_uchar = t.fn(LIBGOBJECT, "g_value_set_uchar", [{ type: GVALUE_BORROWED }, { type: t.uint8 }], t.void);
const g_value_get_uchar = t.fn(LIBGOBJECT, "g_value_get_uchar", [{ type: GVALUE_BORROWED }], t.uint8);
const g_value_set_enum = t.fn(LIBGOBJECT, "g_value_set_enum", [{ type: GVALUE_BORROWED }, { type: t.int32 }], t.void);
const g_value_get_enum = t.fn(LIBGOBJECT, "g_value_get_enum", [{ type: GVALUE_BORROWED }], t.int32);
const g_value_set_flags = t.fn(
    LIBGOBJECT,
    "g_value_set_flags",
    [{ type: GVALUE_BORROWED }, { type: t.uint32 }],
    t.void,
);
const g_value_get_flags = t.fn(LIBGOBJECT, "g_value_get_flags", [{ type: GVALUE_BORROWED }], t.uint32);
const g_value_set_object = t.fn(
    LIBGOBJECT,
    "g_value_set_object",
    [{ type: GVALUE_BORROWED }, { type: t.object("borrowed"), optional: true }],
    t.void,
);
const g_value_get_object = t.fn(LIBGOBJECT, "g_value_get_object", [{ type: GVALUE_BORROWED }], t.object("borrowed"));

const PARAM_FUNDAMENTAL = t.fundamental(LIBGOBJECT, "g_param_spec_ref", "g_param_spec_unref", {
    ownership: "borrowed",
    typeName: "GParam",
});
const g_value_set_param = t.fn(
    LIBGOBJECT,
    "g_value_set_param",
    [{ type: GVALUE_BORROWED }, { type: PARAM_FUNDAMENTAL, optional: true }],
    t.void,
);
const g_value_get_param = t.fn(LIBGOBJECT, "g_value_get_param", [{ type: GVALUE_BORROWED }], PARAM_FUNDAMENTAL);

const VARIANT_FUNDAMENTAL = t.fundamental("libgobject-2.0.so.0,libglib-2.0.so.0", "g_variant_ref", "g_variant_unref", {
    ownership: "borrowed",
    typeName: "GVariant",
});
const g_value_set_variant = t.fn(
    LIBGOBJECT,
    "g_value_set_variant",
    [{ type: GVALUE_BORROWED }, { type: VARIANT_FUNDAMENTAL, optional: true }],
    t.void,
);
const g_value_get_variant = t.fn(LIBGOBJECT, "g_value_get_variant", [{ type: GVALUE_BORROWED }], VARIANT_FUNDAMENTAL);

let variantClass: AnyClass | undefined;

/**
 * Supplies the `GLib.Variant` wrapper class used by {@link GValue.getVariant}.
 *
 * `GVariant` is a non-GObject fundamental with no registered `GType`, so the
 * registry cannot resolve its wrapper from a bare pointer the way it does for
 * GObjects. The generated `GLib` overlay registers the concrete class here so
 * the runtime can wrap variant payloads without importing generated code.
 *
 * @param cls - The `GLib.Variant` wrapper class
 */
export function setVariantClass(cls: AnyClass): void {
    variantClass = cls;
}

/**
 * Low-level wrapper over a freshly allocated `GValue` struct.
 *
 * Mirrors the subset of the generated `GObject.Value` surface the runtime
 * marshalling layer relies on, but binds every accessor through raw FFI so it
 * carries no generated dependency. Boxed access is intentionally absent: the
 * registry-aware boxed marshalling lives in `./gvalue.js` and reads the handle
 * directly.
 */
export class GValue {
    constructor() {
        setHandle(this, alloc(GVALUE_SIZE, "GValue"));
    }

    /** Initializes the value to hold `gType`. */
    init(gType: GType): void {
        g_value_init(getHandle(this), gType);
    }

    setBoolean(value: boolean): void {
        g_value_set_boolean(getHandle(this), value);
    }
    getBoolean(): boolean {
        return Boolean(g_value_get_boolean(getHandle(this)));
    }
    setInt(value: number): void {
        g_value_set_int(getHandle(this), value);
    }
    getInt(): number {
        return g_value_get_int(getHandle(this)) as number;
    }
    setUint(value: number): void {
        g_value_set_uint(getHandle(this), value);
    }
    getUint(): number {
        return g_value_get_uint(getHandle(this)) as number;
    }
    setLong(value: number): void {
        g_value_set_long(getHandle(this), value);
    }
    getLong(): number {
        return g_value_get_long(getHandle(this)) as number;
    }
    setUlong(value: number): void {
        g_value_set_ulong(getHandle(this), value);
    }
    getUlong(): number {
        return g_value_get_ulong(getHandle(this)) as number;
    }
    setInt64(value: number): void {
        g_value_set_int64(getHandle(this), value);
    }
    getInt64(): number {
        return g_value_get_int64(getHandle(this)) as number;
    }
    setUint64(value: number): void {
        g_value_set_uint64(getHandle(this), value);
    }
    getUint64(): number {
        return g_value_get_uint64(getHandle(this)) as number;
    }
    setFloat(value: number): void {
        g_value_set_float(getHandle(this), value);
    }
    getFloat(): number {
        return g_value_get_float(getHandle(this)) as number;
    }
    setDouble(value: number): void {
        g_value_set_double(getHandle(this), value);
    }
    getDouble(): number {
        return g_value_get_double(getHandle(this)) as number;
    }
    setString(value: string | null): void {
        g_value_set_string(getHandle(this), value);
    }
    getString(): string | null {
        return (g_value_get_string(getHandle(this)) as string | null) ?? null;
    }
    setSchar(value: number): void {
        g_value_set_schar(getHandle(this), value);
    }
    getSchar(): number {
        return g_value_get_schar(getHandle(this)) as number;
    }
    setUchar(value: number): void {
        g_value_set_uchar(getHandle(this), value);
    }
    getUchar(): number {
        return g_value_get_uchar(getHandle(this)) as number;
    }
    setEnum(value: number): void {
        g_value_set_enum(getHandle(this), value);
    }
    getEnum(): number {
        return g_value_get_enum(getHandle(this)) as number;
    }
    setFlags(value: number): void {
        g_value_set_flags(getHandle(this), value);
    }
    getFlags(): number {
        return g_value_get_flags(getHandle(this)) as number;
    }
    setObject(value: object | null): void {
        g_value_set_object(getHandle(this), tryGetHandle(value));
    }
    getObject(): object | null {
        return getNativeObject(g_value_get_object(getHandle(this)) as NativeHandle | null);
    }
    setParam(value: object | null): void {
        g_value_set_param(getHandle(this), tryGetHandle(value));
    }
    getParam(): object | null {
        return getNativeObject(g_value_get_param(getHandle(this)) as NativeHandle | null);
    }
    setVariant(value: object | null): void {
        g_value_set_variant(getHandle(this), tryGetHandle(value));
    }
    getVariant(): object | null {
        const result = g_value_get_variant(getHandle(this)) as NativeHandle | null;
        if (result === null) return null;
        if (variantClass === undefined) {
            throw new Error("GValue.getVariant: GLib.Variant wrapper class is not registered");
        }
        return getNativeObject(result, variantClass);
    }
}
