import type { AnyClass } from "@gtkx/utils";

export type Mixin = (base: AnyClass) => AnyClass;

function definedInClassChain(prototype: object, key: string): boolean {
    let current: object | null = prototype;
    while (current !== null && current !== Object.prototype) {
        if (Object.hasOwn(current, key)) return true;
        current = Object.getPrototypeOf(current);
    }
    return false;
}

export function installMixins(target: AnyClass, makers: Mixin[]): void {
    const empty: AnyClass = class {};
    for (const make of makers) {
        const layer: object = make(empty).prototype;
        for (const key of Object.getOwnPropertyNames(layer)) {
            if (key === "constructor") continue;
            if (definedInClassChain(target.prototype, key)) continue;
            const descriptor = Object.getOwnPropertyDescriptor(layer, key);
            if (descriptor !== undefined) Object.defineProperty(target.prototype, key, descriptor);
        }
    }
}
