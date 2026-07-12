import type { AnyClass } from "@gtkx/utils";

/**
 * The signal-connecting capabilities a mixin can rely on being present on the
 * classes it is applied to.
 */
export type MixinReceiver = {
    connect(signal: string, handler: (...args: unknown[]) => unknown, after?: boolean): number;
    emit(signal: string, ...args: unknown[]): unknown;
};

/**
 * A factory that, given a base class, returns a subclass adding extra members to
 * be merged onto a target prototype.
 */
export type Mixin = (base: AnyClass<MixinReceiver>) => AnyClass;

function definedInClassChain(prototype: object, key: string): boolean {
    let current: object | null = prototype;
    while (current !== null && current !== Object.prototype) {
        if (Object.hasOwn(current, key)) return true;
        current = Object.getPrototypeOf(current);
    }
    return false;
}

/**
 * Copies each mixin's prototype members onto the target class prototype, skipping
 * any member already defined anywhere in the target's class chain.
 *
 * @param target The class whose prototype receives the mixin members.
 * @param mixins The mixins to apply, in order.
 */
export function installMixins(target: AnyClass, mixins: Mixin[]): void {
    const empty: AnyClass<MixinReceiver> = class {
        connect(): number {
            return 0;
        }
        emit(): unknown {
            return undefined;
        }
    };
    for (const mixin of mixins) {
        const layer: object = mixin(empty).prototype;
        for (const key of Object.getOwnPropertyNames(layer)) {
            if (key === "constructor") continue;
            if (definedInClassChain(target.prototype, key)) continue;
            const descriptor = Object.getOwnPropertyDescriptor(layer, key);
            if (descriptor !== undefined) Object.defineProperty(target.prototype, key, descriptor);
        }
    }
}
