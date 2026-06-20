import type { ArrayType, Type as FfiType, Handle, Value } from "@gtkx/native";
import { getDescriptorWrapperClass } from "./descriptors.js";
import { type GType, TYPE_INVALID, typeFromName, typeName } from "./gtype.js";
import { resolveBoxedGtype } from "./gvalue.js";
import { getWrapperClass, tryGetHandle, wrapHandle, wrapInterfaceHandle } from "./registry.js";

const wrapCollection = (ffiType: ArrayType, value: unknown): unknown => {
    if (value === null) return null;
    return (value as Value[]).map((item) => wrapValue(ffiType.itemType, item));
};

type GObjectFfiType = Extract<FfiType, { type: "gobject" }>;

const interfaceGtypeByName = new Map<string, GType>();

const interfaceGtype = (typeName: string): GType => {
    const cached = interfaceGtypeByName.get(typeName);
    if (cached !== undefined) return cached;
    const gtype = typeFromName(typeName);
    if (gtype !== TYPE_INVALID) interfaceGtypeByName.set(typeName, gtype);
    return gtype;
};

const wrapGObjectValue = (ffiType: GObjectFfiType, value: Handle | null): object | null => {
    if (ffiType.typeName === undefined) return wrapHandle(value, undefined);
    const gtype = interfaceGtype(ffiType.typeName);
    if (gtype === TYPE_INVALID) return wrapHandle(value, undefined);
    return wrapInterfaceHandle(value, gtype);
};

const wrapBoxedValue = (ffiType: FfiType, value: Handle | null): object | null => {
    if (value === null) return null;
    const paired = getDescriptorWrapperClass(ffiType);
    if (paired !== undefined) return wrapHandle(value, paired);
    const gtype = resolveBoxedGtype(ffiType);
    const cls = getWrapperClass(gtype);
    if (cls === null) {
        throw new Error(`wrapValue: no registered wrapper class for boxed GType '${typeName(gtype) ?? String(gtype)}'`);
    }
    return wrapHandle(value, cls);
};

export function wrapValue(ffiType: FfiType, value: Value): unknown {
    switch (ffiType.type) {
        case "gobject":
            return wrapGObjectValue(ffiType, value as Handle | null);
        case "struct":
            return wrapHandle(value as Handle | null, getDescriptorWrapperClass(ffiType));
        case "boxed":
        case "fundamental":
            return wrapBoxedValue(ffiType, value as Handle | null);
        case "array":
            return wrapCollection(ffiType, value);
        case "hashtable": {
            if (value === null) return null;
            const entries = value as [Value, Value][];
            return new Map(
                entries.map(([key, val]): [unknown, unknown] => [
                    wrapValue(ffiType.keyType, key),
                    wrapValue(ffiType.valueType, val),
                ]),
            );
        }
        default:
            return value;
    }
}

const unwrapCollection = (ffiType: ArrayType, value: unknown): Value => {
    if (value == null) return null;
    return (value as unknown[]).map((item) => unwrapValue(ffiType.itemType, item));
};

export function unwrapValue(ffiType: FfiType, value: unknown): Value {
    switch (ffiType.type) {
        case "gobject":
        case "struct":
        case "boxed":
        case "fundamental":
            return tryGetHandle(value as object | null | undefined) ?? null;
        case "array":
            return unwrapCollection(ffiType, value);
        case "hashtable": {
            if (value == null) return null;
            return [...(value as Map<unknown, unknown>)].map(([key, val]): [Value, Value] => [
                unwrapValue(ffiType.keyType, key),
                unwrapValue(ffiType.valueType, val),
            ]);
        }
        default:
            return value as Value;
    }
}
