import type { NativeHandle } from "@gtkx/native";
import { call, read } from "../batch.js";
import { typeFromName, typeName } from "../generated/gobject/functions.js";
import type { GObject } from "../generated/gobject/object.js";
import { Value } from "../generated/gobject/value.js";
import type { NativeClass, NativeObject } from "../native/base.js";
import { getNativeObject } from "../native/object.js";
import { Type } from "./types.js";

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
         * Gets the contents of a G_TYPE_BOXED derived GValue.
         * Returns a borrowed reference to the boxed value.
         * @param targetType - The class constructor to wrap the result with
         * @returns The boxed value wrapped in the target type, or null
         */
        getBoxed<T extends NativeObject>(targetType: NativeClass<T>): T | null;

        /**
         * Gets the contents of a G_TYPE_BOXED derived GValue, duplicating the value.
         * Returns an owned copy that must be freed by the caller.
         * @param targetType - The class constructor to wrap the result with
         * @returns A duplicated boxed value wrapped in the target type, or null
         */
        dupBoxed<T extends NativeObject>(targetType: NativeClass<T>): T | null;
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
        "g_value_get_boxed",
        [
            {
                type: { type: "boxed", ownership: "borrowed", innerType: "GValue", library: "libgobject-2.0.so.0" },
                value: this.handle,
            },
        ],
        { type: "boxed", ownership: "borrowed", innerType: glibTypeName, library: "libgobject-2.0.so.0" },
    );
    if (ptr === null) return null;
    return getNativeObject(ptr as NativeHandle, targetType);
};

Value.prototype.dupBoxed = function <T extends NativeObject>(targetType: NativeClass<T>): T | null {
    const glibTypeName = targetType.glibTypeName;
    if (!glibTypeName) {
        throw new Error("targetType must have a glibTypeName");
    }
    const ptr = call(
        "libgobject-2.0.so.0",
        "g_value_dup_boxed",
        [
            {
                type: { type: "boxed", ownership: "borrowed", innerType: "GValue", library: "libgobject-2.0.so.0" },
                value: this.handle,
            },
        ],
        { type: "boxed", ownership: "full", innerType: glibTypeName, library: "libgobject-2.0.so.0" },
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
    const gtype = typeFromName((value.constructor as typeof NativeObject).glibTypeName);
    v.init(gtype);
    v.setBoxed(value.handle as unknown as number);
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
