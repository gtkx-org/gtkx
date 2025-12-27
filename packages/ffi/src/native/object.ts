import { getObjectId } from "@gtkx/native";
import { typeCheckInstanceIsA, typeFromName, typeNameFromInstance } from "../generated/gobject/functions.js";
import { findNativeClass } from "../registry.js";
import type { NativeClass, NativeObject } from "./base.js";

export function getNativeObject<T extends NativeObject = NativeObject>(
    id: unknown,
    targetType?: NativeClass<T>,
): T | null {
    if (id === null || id === undefined) {
        return null;
    }

    if (targetType) {
        if (targetType.objectType === "interface") {
            const targetGType = typeFromName(targetType.glibTypeName);
            if (targetGType === 0) return null;

            const objId = getObjectId(id);
            if (!typeCheckInstanceIsA(objId, targetGType)) return null;
        }

        const instance = Object.create(targetType.prototype) as T;
        instance.id = id;
        return instance;
    }

    const objectId = getObjectId(id);
    const runtimeTypeName = typeNameFromInstance(objectId);
    const cls = findNativeClass(runtimeTypeName);

    if (!cls) {
        throw new Error(`Expected registered GLib type, got '${runtimeTypeName}'`);
    }

    const instance = Object.create(cls.prototype) as T;
    instance.id = id;
    return instance;
}

export { isInstantiating, type NativeClass, NativeObject, setInstantiating } from "./base.js";
