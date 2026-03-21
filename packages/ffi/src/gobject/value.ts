import type { Type as FfiType, NativeHandle } from "@gtkx/native";
import { typeFromName, typeFundamental, typeName } from "../generated/gobject/functions.js";
import type { Object as GObject } from "../generated/gobject/object.js";
import { Value } from "../generated/gobject/value.js";
import type { NativeClass, NativeObject } from "../native.js";
import { call, read } from "../native.js";
import { getNativeObject } from "../registry.js";
import { Type } from "./types.js";

let cachedStrvGType: number | undefined;
function getStrvGType(): number {
    cachedStrvGType ??= call("libgobject-2.0.so.0", "g_strv_get_type", [], {
        type: "int",
        size: 64,
        unsigned: true,
    }) as number;
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
    }
}

Value.prototype.getType = function (): number {
    return read(this.handle, { type: "int", size: 64, unsigned: true }, 0) as number;
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
        [
            {
                type: {
                    type: "boxed",
                    ownership: "borrowed",
                    innerType: "GValue",
                    library: "libgobject-2.0.so.0",
                },
                value: this.handle,
            },
        ],
        {
            type: "boxed",
            ownership: "full",
            innerType: glibTypeName,
            library: "libgobject-2.0.so.0",
        },
    );
    if (ptr === null) return null;
    return getNativeObject(ptr as NativeHandle, targetType);
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
};

const ValueWithStatics = Value as typeof Value & ValueStatic;

ValueWithStatics.newFromBoolean = (value: boolean): Value => {
    const v = new Value();
    v.init(Type.BOOLEAN);
    v.setBoolean(value);
    return v;
};

ValueWithStatics.newFromInt = (value: number): Value => {
    const v = new Value();
    v.init(Type.INT);
    v.setInt(value);
    return v;
};

ValueWithStatics.newFromUint = (value: number): Value => {
    const v = new Value();
    v.init(Type.UINT);
    v.setUint(value);
    return v;
};

ValueWithStatics.newFromLong = (value: number): Value => {
    const v = new Value();
    v.init(Type.LONG);
    v.setLong(value);
    return v;
};

ValueWithStatics.newFromUlong = (value: number): Value => {
    const v = new Value();
    v.init(Type.ULONG);
    v.setUlong(value);
    return v;
};

ValueWithStatics.newFromInt64 = (value: number): Value => {
    const v = new Value();
    v.init(Type.INT64);
    v.setInt64(value);
    return v;
};

ValueWithStatics.newFromUint64 = (value: number): Value => {
    const v = new Value();
    v.init(Type.UINT64);
    v.setUint64(value);
    return v;
};

ValueWithStatics.newFromFloat = (value: number): Value => {
    const v = new Value();
    v.init(Type.FLOAT);
    v.setFloat(value);
    return v;
};

ValueWithStatics.newFromDouble = (value: number): Value => {
    const v = new Value();
    v.init(Type.DOUBLE);
    v.setDouble(value);
    return v;
};

ValueWithStatics.newFromString = (value: string | null): Value => {
    const v = new Value();
    v.init(Type.STRING);
    v.setString(value);
    return v;
};

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
    const v = new Value();
    const ctor = value.constructor as typeof NativeObject;
    const gtype = typeFromName(ctor.glibTypeName);
    v.init(gtype);
    call(
        "libgobject-2.0.so.0",
        "g_value_set_boxed",
        [
            {
                type: {
                    type: "boxed",
                    ownership: "borrowed",
                    innerType: "GValue",
                    library: "libgobject-2.0.so.0",
                    getTypeFn: "g_value_get_type",
                },
                value: v.handle,
            },
            {
                type: {
                    type: "boxed",
                    ownership: "borrowed",
                    innerType: ctor.glibTypeName,
                    library: "libgobject-2.0.so.0",
                },
                value: value.handle,
            },
        ],
        { type: "undefined" },
    );
    return v;
};

ValueWithStatics.newFromStrv = (value: string[]): Value => {
    const v = new Value();
    v.init(getStrvGType());
    call(
        "libgobject-2.0.so.0",
        "g_value_set_boxed",
        [
            {
                type: {
                    type: "boxed",
                    ownership: "borrowed",
                    innerType: "GValue",
                    library: "libgobject-2.0.so.0",
                    getTypeFn: "g_value_get_type",
                },
                value: v.handle,
            },
            {
                type: {
                    type: "array",
                    itemType: { type: "string", ownership: "borrowed" },
                    kind: "array" as const,
                    ownership: "borrowed" as const,
                },
                value,
            },
        ],
        { type: "undefined" },
    );
    return v;
};

ValueWithStatics.newFromVariant = (value: NativeObject): Value => {
    const v = new Value();
    v.init(Type.VARIANT);
    call(
        "libgobject-2.0.so.0",
        "g_value_set_variant",
        [
            {
                type: {
                    type: "boxed",
                    ownership: "borrowed",
                    innerType: "GValue",
                    library: "libgobject-2.0.so.0",
                    getTypeFn: "g_value_get_type",
                },
                value: v.handle,
            },
            {
                type: {
                    type: "fundamental",
                    ownership: "borrowed",
                    library: "libgobject-2.0.so.0",
                    refFn: "g_variant_ref_sink",
                    unrefFn: "g_variant_unref",
                },
                value: value.handle,
            },
        ],
        { type: "undefined" },
    );
    return v;
};

ValueWithStatics.newFromEnum = (gtype: number, value: number): Value => {
    const v = new Value();
    v.init(gtype);
    v.setEnum(value);
    return v;
};

ValueWithStatics.newFromFlags = (gtype: number, value: number): Value => {
    const v = new Value();
    v.init(gtype);
    v.setFlags(value);
    return v;
};

export function toValue(ffiType: FfiType, value: unknown): Value {
    switch (ffiType.type) {
        case "boolean":
            return Value.newFromBoolean(value as boolean);

        case "string":
            return Value.newFromString(value as string | null);

        case "int": {
            if (ffiType.getTypeFn && ffiType.library) {
                const gtype = call(ffiType.library, ffiType.getTypeFn, [], {
                    type: "int",
                    size: 64,
                    unsigned: true,
                }) as number;
                const fundamental = typeFundamental(gtype);
                if (fundamental === Type.FLAGS) {
                    return Value.newFromFlags(gtype, value as number);
                }
                return Value.newFromEnum(gtype, value as number);
            }

            if (ffiType.size === 64) {
                return ffiType.unsigned ? Value.newFromUint64(value as number) : Value.newFromInt64(value as number);
            }
            return ffiType.unsigned ? Value.newFromUint(value as number) : Value.newFromInt(value as number);
        }

        case "float":
            return ffiType.size === 64 ? Value.newFromDouble(value as number) : Value.newFromFloat(value as number);

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
}
