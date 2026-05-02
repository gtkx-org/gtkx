import type { Type as FfiType, NativeHandle } from "@gtkx/native";
import { typeFromName, typeFundamental, typeName } from "../generated/gobject/functions.js";
import type { Object as GObject } from "../generated/gobject/object.js";
import type { ParamSpec } from "../generated/gobject/param-spec.js";
import { Value } from "../generated/gobject/value.js";
import type { NativeClass, NativeObject } from "../native.js";
import { call, read, t } from "../native.js";
import { findNativeClass, getNativeObject } from "../registry.js";
import { Type } from "./types.js";

const GVALUE_ARG = t.boxed("GValue", "borrowed", "libgobject-2.0.so.0", "g_value_get_type");

const g_strv_get_type = t.fn("libgobject-2.0.so.0", "g_strv_get_type", [], t.uint64);

const g_value_set_boxed_strv = t.fn(
    "libgobject-2.0.so.0",
    "g_value_set_boxed",
    [{ type: GVALUE_ARG }, { type: t.array(t.string("borrowed")) }],
    t.void,
);

const g_value_get_boxed_strv = t.fn(
    "libgobject-2.0.so.0",
    "g_value_get_boxed",
    [{ type: GVALUE_ARG }],
    t.array(t.string("borrowed")),
);

let cachedStrvGType: number | undefined;
function getStrvGType(): number {
    cachedStrvGType ??= g_strv_get_type() as number;
    return cachedStrvGType;
}

declare module "../generated/gobject/value.js" {
    interface Value {
        /**
         * Gets the Type of the value stored in this GValue.
         * This is equivalent to the C macro G_VALUE_TYPE(value).
         * @returns The Type identifier
         */
        getType(): number;

        /**
         * Gets the name of the Type stored in this GValue.
         * This is equivalent to G_VALUE_TYPE_NAME(value).
         * @returns The type name string
         */
        getTypeName(): string;

        /**
         * Checks if this GValue holds a value of the specified Type.
         * This is equivalent to G_VALUE_HOLDS(value, type).
         * @param gtype - The Type to check against
         * @returns true if the value holds the specified type
         */
        holds(gtype: number): boolean;

        /**
         * Gets an owned copy of the boxed value from a G_TYPE_BOXED derived GValue.
         * @param targetType - The class constructor to wrap the result with
         * @returns An owned copy of the boxed value wrapped in the target type, or null
         */
        getBoxed<T extends NativeObject>(targetType: NativeClass<T>): T | null;

        /**
         * Gets the contents of a G_TYPE_STRV (`gchar**`) GValue as a JS string array.
         * Returns an empty array if the underlying GStrv pointer is NULL.
         */
        getStrv(): string[];

        /**
         * Unmarshals this GValue into a plain JavaScript value.
         *
         * Dispatches on `typeFundamental(this.getType())`:
         * - Numeric/boolean fundamentals return their primitive JS form.
         * - STRING returns `string | null` (NULL strings are preserved as `null`).
         * - ENUM/FLAGS return the integer payload.
         * - OBJECT returns the wrapped GObject instance, or `null`.
         * - VARIANT returns the wrapped Variant instance, or `null`.
         * - PARAM returns the wrapped ParamSpec instance.
         * - BOXED with the GStrv concrete type returns `string[]`.
         * - BOXED with any other type resolves the wrapper class via the registry
         *   and returns the wrapped instance; throws if no class is registered.
         * - POINTER returns `null` for a null pointer; throws otherwise.
         *
         * @throws if the GValue holds an unsupported or unregistered type.
         */
        toJS(): unknown;
    }

    namespace Value {
        /**
         * Creates a GValue initialized with a boolean.
         * @param value - The boolean value
         */
        function newFromBoolean(value: boolean): Value;
        /**
         * Creates a GValue initialized with a signed 32-bit integer.
         * @param value - The integer value
         */
        function newFromInt(value: number): Value;
        /**
         * Creates a GValue initialized with an unsigned 32-bit integer.
         * @param value - The unsigned integer value
         */
        function newFromUint(value: number): Value;
        /**
         * Creates a GValue initialized with a signed long integer.
         * @param value - The long value
         */
        function newFromLong(value: number): Value;
        /**
         * Creates a GValue initialized with an unsigned long integer.
         * @param value - The unsigned long value
         */
        function newFromUlong(value: number): Value;
        /**
         * Creates a GValue initialized with a signed 64-bit integer.
         * @param value - The 64-bit integer value
         */
        function newFromInt64(value: number): Value;
        /**
         * Creates a GValue initialized with an unsigned 64-bit integer.
         * @param value - The unsigned 64-bit integer value
         */
        function newFromUint64(value: number): Value;
        /**
         * Creates a GValue initialized with a 32-bit float.
         * @param value - The float value
         */
        function newFromFloat(value: number): Value;
        /**
         * Creates a GValue initialized with a 64-bit double.
         * @param value - The double value
         */
        function newFromDouble(value: number): Value;
        /**
         * Creates a GValue initialized with a string.
         * @param value - The string value, or null
         */
        function newFromString(value: string | null): Value;
        /**
         * Creates a GValue initialized with a GObject instance.
         * The GType is automatically determined from the object's class.
         * @param value - The GObject instance, or null
         */
        function newFromObject(value: GObject | null): Value;
        /**
         * Creates a GValue initialized with a boxed type instance.
         * The GType is automatically determined from the object's class.
         * @param value - The boxed type instance (e.g., Gdk.RGBA, Graphene.Rect)
         */
        function newFromBoxed(value: NativeObject): Value;
        /**
         * Creates a GValue initialized with a null-terminated string array (GStrv).
         * @param value - The string array
         */
        function newFromStrv(value: string[]): Value;
        /**
         * Creates a GValue initialized with a GVariant.
         * @param value - The GVariant instance
         */
        function newFromVariant(value: NativeObject): Value;
        /**
         * Creates a GValue initialized with an enum value.
         * @param gtype - The GType of the enum
         * @param value - The enum value
         */
        function newFromEnum(gtype: number, value: number): Value;
        /**
         * Creates a GValue initialized with a flags value.
         * @param gtype - The GType of the flags
         * @param value - The flags value (can be combined with bitwise OR)
         */
        function newFromFlags(gtype: number, value: number): Value;
        /**
         * Creates a GValue from an FFI type descriptor and a JS value.
         * Dispatches to the appropriate `newFrom*` constructor based on the type.
         * @param ffiType - The FFI type descriptor
         * @param value - The JS value to convert
         */
        function newFrom(ffiType: FfiType, value: unknown): Value;

        /**
         * Creates a GValue typed as `gtype` and marshals `value` into it.
         *
         * The runtime counterpart to {@link Value.newFrom}: where `newFrom` consumes
         * a codegen-time FFI type descriptor, `fromJS` consumes a runtime GType
         * integer (typically derived from a GParamSpec via `pspec.getDefaultValue().getType()`).
         *
         * Dispatches on `typeFundamental(gtype)` and special-cases the GStrv concrete
         * GType so a JS `string[]` is marshalled before falling into the generic
         * boxed branch.
         *
         * @param gtype - The concrete GType (not necessarily the fundamental)
         * @param value - The JS value to marshal
         * @throws on G_TYPE_POINTER with a non-null value, or unsupported GTypes.
         */
        function fromJS(gtype: number, value: unknown): Value;
    }
}

function initValue(gtype: number, populate: (v: Value) => void): Value {
    const v = new Value();
    v.init(gtype);
    populate(v);
    return v;
}

Value.prototype.getType = function (): number {
    return read(this.handle, t.uint64, 0) as number;
};

Value.prototype.getTypeName = function (): string {
    const gtype = this.getType();
    return typeName(gtype) ?? "invalid";
};

Value.prototype.holds = function (gtype: number): boolean {
    return this.getType() === gtype;
};

Value.prototype.getBoxed = function <T extends NativeObject>(targetType: NativeClass<T>): T | null {
    const glibTypeName = targetType.glibTypeName;
    if (!glibTypeName) {
        throw new Error("targetType must have a glibTypeName");
    }
    const ptr = call(
        "libgobject-2.0.so.0",
        "g_value_dup_boxed",
        [{ type: t.boxed("GValue", "borrowed", "libgobject-2.0.so.0"), value: this.handle }],
        t.boxed(glibTypeName, "full", "libgobject-2.0.so.0"),
    );
    if (ptr === null) return null;
    return getNativeObject(ptr as NativeHandle, targetType);
};

Value.prototype.getStrv = function (): string[] {
    return (g_value_get_boxed_strv(this.handle) as string[] | null) ?? [];
};

const valueFromFundamental = (value: Value, fundamental: number): unknown => {
    if (fundamental === Type.BOOLEAN) return value.getBoolean();
    if (fundamental === Type.INT) return value.getInt();
    if (fundamental === Type.UINT) return value.getUint();
    if (fundamental === Type.LONG) return value.getLong();
    if (fundamental === Type.ULONG) return value.getUlong();
    if (fundamental === Type.INT64) return value.getInt64();
    if (fundamental === Type.UINT64) return value.getUint64();
    if (fundamental === Type.FLOAT) return value.getFloat();
    if (fundamental === Type.DOUBLE) return value.getDouble();
    if (fundamental === Type.CHAR) return value.getSchar();
    if (fundamental === Type.UCHAR) return value.getUchar();
    if (fundamental === Type.STRING) return value.getString();
    if (fundamental === Type.ENUM) return value.getEnum();
    if (fundamental === Type.FLAGS) return value.getFlags();
    if (fundamental === Type.OBJECT) return value.getObject();
    if (fundamental === Type.VARIANT) return value.getVariant();
    if (fundamental === Type.PARAM) return value.getParam();
    return undefined;
};

const readPointerValue = (handle: NativeHandle): null => {
    const ptr = read(handle, t.uint64, 8) as number;
    if (ptr !== 0) {
        throw new Error("G_TYPE_POINTER non-null values cannot be marshalled to JS");
    }
    return null;
};

const readBoxedValue = (value: Value, gtype: number): unknown => {
    const concreteName = typeName(gtype);
    if (!concreteName) {
        throw new Error(`Cannot resolve type name for boxed GType ${gtype}`);
    }
    const cls = findNativeClass(concreteName, false);
    if (!cls) {
        throw new Error(`No registered class for boxed GType '${concreteName}'`);
    }
    return value.getBoxed(cls);
};

Value.prototype.toJS = function (): unknown {
    const gtype = this.getType();

    if (gtype === getStrvGType()) return this.getStrv();

    const fundamental = typeFundamental(gtype);
    const fundamentalValue = valueFromFundamental(this, fundamental);
    if (fundamentalValue !== undefined) return fundamentalValue;

    if (fundamental === Type.POINTER) return readPointerValue(this.handle);
    if (fundamental === Type.BOXED) return readBoxedValue(this, gtype);

    throw new Error(`Unsupported GType for Value.toJS: ${typeName(gtype) ?? gtype}`);
};

type ValueStatic = {
    newFromBoolean(value: boolean): Value;
    newFromInt(value: number): Value;
    newFromUint(value: number): Value;
    newFromLong(value: number): Value;
    newFromUlong(value: number): Value;
    newFromInt64(value: number): Value;
    newFromUint64(value: number): Value;
    newFromFloat(value: number): Value;
    newFromDouble(value: number): Value;
    newFromString(value: string | null): Value;
    newFromObject(value: GObject | null): Value;
    newFromBoxed(value: NativeObject): Value;
    newFromStrv(value: string[]): Value;
    newFromVariant(value: NativeObject): Value;
    newFromEnum(gtype: number, value: number): Value;
    newFromFlags(gtype: number, value: number): Value;
    newFrom(ffiType: FfiType, value: unknown): Value;
    fromJS(gtype: number, value: unknown): Value;
};

const ValueWithStatics = Value as typeof Value & ValueStatic;

ValueWithStatics.newFromBoolean = (value) => initValue(Type.BOOLEAN, (v) => v.setBoolean(value));
ValueWithStatics.newFromInt = (value) => initValue(Type.INT, (v) => v.setInt(value));
ValueWithStatics.newFromUint = (value) => initValue(Type.UINT, (v) => v.setUint(value));
ValueWithStatics.newFromLong = (value) => initValue(Type.LONG, (v) => v.setLong(value));
ValueWithStatics.newFromUlong = (value) => initValue(Type.ULONG, (v) => v.setUlong(value));
ValueWithStatics.newFromInt64 = (value) => initValue(Type.INT64, (v) => v.setInt64(value));
ValueWithStatics.newFromUint64 = (value) => initValue(Type.UINT64, (v) => v.setUint64(value));
ValueWithStatics.newFromFloat = (value) => initValue(Type.FLOAT, (v) => v.setFloat(value));
ValueWithStatics.newFromDouble = (value) => initValue(Type.DOUBLE, (v) => v.setDouble(value));
ValueWithStatics.newFromString = (value) => initValue(Type.STRING, (v) => v.setString(value));

ValueWithStatics.newFromObject = (value: GObject | null): Value => {
    const v = new Value();
    if (value) {
        const gtype = typeFromName((value.constructor as typeof GObject).glibTypeName);
        v.init(gtype);
    } else {
        v.init(Type.OBJECT);
    }
    v.setObject(value);
    return v;
};

ValueWithStatics.newFromBoxed = (value: NativeObject): Value => {
    const ctor = value.constructor as typeof NativeObject;
    return initValue(typeFromName(ctor.glibTypeName), (v) => v.setBoxed(value.handle as unknown as number));
};

ValueWithStatics.newFromStrv = (value: string[]): Value =>
    initValue(getStrvGType(), (v) => g_value_set_boxed_strv(v.handle, value));

ValueWithStatics.newFromVariant = (value: NativeObject): Value =>
    initValue(Type.VARIANT, (v) => v.setVariant(value as unknown as Parameters<Value["setVariant"]>[0]));

ValueWithStatics.newFromEnum = (gtype, value) => initValue(gtype, (v) => v.setEnum(value));
ValueWithStatics.newFromFlags = (gtype, value) => initValue(gtype, (v) => v.setFlags(value));

ValueWithStatics.newFrom = (ffiType: FfiType, value: unknown): Value => {
    switch (ffiType.type) {
        case "boolean":
            return Value.newFromBoolean(value as boolean);

        case "string":
            return Value.newFromString(value as string | null);

        case "enum": {
            const gtype = call(ffiType.library, ffiType.getTypeFn, [], t.uint64) as number;
            const fundamental = typeFundamental(gtype);
            if (fundamental === Type.FLAGS) {
                return Value.newFromFlags(gtype, value as number);
            }
            return Value.newFromEnum(gtype, value as number);
        }

        case "flags": {
            const gtype = call(ffiType.library, ffiType.getTypeFn, [], t.uint64) as number;
            return Value.newFromFlags(gtype, value as number);
        }

        case "int8":
        case "int16":
        case "int32":
            return Value.newFromInt(value as number);

        case "uint8":
        case "uint16":
        case "uint32":
            return Value.newFromUint(value as number);

        case "int64":
            return Value.newFromInt64(value as number);

        case "uint64":
            return Value.newFromUint64(value as number);

        case "float32":
            return Value.newFromFloat(value as number);

        case "float64":
            return Value.newFromDouble(value as number);

        case "gobject":
            return Value.newFromObject(value as GObject | null);

        case "boxed":
            return Value.newFromBoxed(value as NativeObject);

        case "array": {
            if (ffiType.itemType.type === "string" && ffiType.kind === "array") {
                return Value.newFromStrv(value as string[]);
            }
            throw new Error(
                `Unsupported array type for GValue conversion: ${ffiType.kind} of ${ffiType.itemType.type}`,
            );
        }

        case "fundamental":
            if (ffiType.refFn === "g_variant_ref_sink") {
                return Value.newFromVariant(value as NativeObject);
            }
            return Value.newFromBoxed(value as NativeObject);

        default:
            throw new Error(`Unsupported FFI type for GValue conversion: ${(ffiType as { type: string }).type}`);
    }
};

const newCharValue = (gtype: number, fundamental: number, value: unknown): Value => {
    const v = new Value();
    v.init(gtype);
    if (fundamental === Type.CHAR) v.setSchar(value as number);
    else v.setUchar(value as number);
    return v;
};

const newPointerValue = (gtype: number, value: unknown): Value => {
    if (value !== null && value !== undefined) {
        throw new Error("G_TYPE_POINTER properties cannot be set from a non-null JS value");
    }
    const v = new Value();
    v.init(gtype);
    return v;
};

const newBoxedValue = (gtype: number, value: unknown): Value => {
    if (value === null || value === undefined) {
        const v = new Value();
        v.init(gtype);
        return v;
    }
    return Value.newFromBoxed(value as NativeObject);
};

const newStrvValue = (gtype: number, value: unknown): Value => {
    if (value === null || value === undefined) {
        const v = new Value();
        v.init(gtype);
        return v;
    }
    return Value.newFromStrv(value as string[]);
};

const valueFromFundamentalFactory = (gtype: number, fundamental: number, value: unknown): Value | null => {
    if (fundamental === Type.BOOLEAN) return Value.newFromBoolean(value as boolean);
    if (fundamental === Type.INT) return Value.newFromInt(value as number);
    if (fundamental === Type.UINT) return Value.newFromUint(value as number);
    if (fundamental === Type.LONG) return Value.newFromLong(value as number);
    if (fundamental === Type.ULONG) return Value.newFromUlong(value as number);
    if (fundamental === Type.INT64) return Value.newFromInt64(value as number);
    if (fundamental === Type.UINT64) return Value.newFromUint64(value as number);
    if (fundamental === Type.FLOAT) return Value.newFromFloat(value as number);
    if (fundamental === Type.DOUBLE) return Value.newFromDouble(value as number);
    if (fundamental === Type.STRING) return Value.newFromString(value as string | null);
    if (fundamental === Type.ENUM) return Value.newFromEnum(gtype, value as number);
    if (fundamental === Type.FLAGS) return Value.newFromFlags(gtype, value as number);
    if (fundamental === Type.OBJECT) return Value.newFromObject(value as GObject | null);
    if (fundamental === Type.VARIANT) return Value.newFromVariant(value as NativeObject);
    return null;
};

ValueWithStatics.fromJS = (gtype: number, value: unknown): Value => {
    if (gtype === getStrvGType()) return newStrvValue(gtype, value);

    const fundamental = typeFundamental(gtype);
    const fundamentalValue = valueFromFundamentalFactory(gtype, fundamental, value);
    if (fundamentalValue) return fundamentalValue;

    if (fundamental === Type.CHAR || fundamental === Type.UCHAR) {
        return newCharValue(gtype, fundamental, value);
    }

    if (fundamental === Type.PARAM) {
        const v = new Value();
        v.init(gtype);
        v.setParam(value as ParamSpec | null);
        return v;
    }

    if (fundamental === Type.POINTER) return newPointerValue(gtype, value);
    if (fundamental === Type.BOXED) return newBoxedValue(gtype, value);

    throw new Error(`Unsupported GType for Value.fromJS: ${typeName(gtype) ?? gtype}`);
};
