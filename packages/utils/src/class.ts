/**
 * Structural type for any class constructor, abstract or concrete.
 *
 * @public
 */
export type AnyClass<T extends object = object> = (abstract new (
    ...args: never[]
) => T) & {
    prototype: T;
};

/**
 * A mixin factory: given a base class it returns a subclass that adds members.
 * Composable, so several mixins chain as `makeA(makeB(makeC(Base)))`.
 *
 * @public
 */
export type Mixin = (base: AnyClass) => AnyClass;

function definedInClassChain(prototype: object, key: string): boolean {
    let current: object | null = prototype;
    while (current !== null && current !== Object.prototype) {
        if (Object.hasOwn(current, key)) return true;
        current = Object.getPrototypeOf(current);
    }
    return false;
}

/**
 * Install the prototype members produced by each {@link Mixin} onto a class,
 * copying every member the target does not already define on its own class
 * chain (its prototype up to, but excluding, `Object.prototype`). Members the
 * class or an ancestor already provides win, so an existing method is never
 * shadowed by a mixin's default.
 *
 * @param target - The class whose prototype receives the mixin members.
 * @param makers - The mixin factories whose members to install.
 * @public
 */
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
