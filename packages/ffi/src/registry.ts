import { typeFromName, typeName, typeParent } from "./generated/gobject/functions.js";
import type { NativeClass } from "./native/object.js";

const registry = new Map<string, NativeClass>();

export function registerNativeClass(cls: NativeClass): void {
    registry.set(cls.glibTypeName, cls);
}

export function getNativeClass(glibTypeName: string): NativeClass | undefined {
    return registry.get(glibTypeName);
}

export const findNativeClass = (glibTypeName: string) => {
    let currentTypeName: string | null = glibTypeName;

    while (currentTypeName) {
        const cls = getNativeClass(currentTypeName);
        if (cls) return cls;

        const gtype = typeFromName(currentTypeName);
        if (gtype === 0) break;

        const parentGtype = typeParent(gtype);
        if (parentGtype === 0) break;

        currentTypeName = typeName(parentGtype);
    }
};
