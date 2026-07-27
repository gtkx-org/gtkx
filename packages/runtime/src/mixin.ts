import type { AnyClass } from "@gtkx/utils";

type MixinReceiver = {
    connect(signal: string, handler: (...args: unknown[]) => unknown, isAfter?: boolean): number;
    emit(signal: string, ...args: unknown[]): unknown;
};

/**
 * A factory that, given a base class, returns a subclass adding extra members to
 * be merged onto a target prototype.
 */
type Mixin = (base: AnyClass<MixinReceiver>) => AnyClass;

function isDefinedInClassChain(prototype: object, key: string): boolean {
    let current: object | null = prototype;

    while (current !== null && current !== Object.prototype) {
        if (Object.hasOwn(current, key)) {
            return true;
        }

        current = Reflect.getPrototypeOf(current);
    }

    return false;
}

function copyLayerMember(target: AnyClass, layer: object, key: string): void {
    if (key === "constructor") {
        return;
    }

    if (isDefinedInClassChain(target.prototype, key)) {
        return;
    }

    const descriptor = Object.getOwnPropertyDescriptor(layer, key);

    if (descriptor !== undefined) {
        Object.defineProperty(target.prototype, key, descriptor);
    }
}

/**
 * Copies each mixin's prototype members onto the target class prototype, skipping
 * any member already defined anywhere in the target's class chain.
 *
 * @param target The class whose prototype receives the mixin members.
 * @param mixins The mixins to apply, in order.
 */
function copyLayerMembers(target: AnyClass, layer: object): void {
    for (const key of Object.getOwnPropertyNames(layer)) {
        copyLayerMember(target, layer, key);
    }
}

function installMixins(target: AnyClass, mixins: Mixin[]): void {
    const empty: AnyClass<MixinReceiver> = class {
        connect(): number {
            return 0;
        }

        emit(): unknown {
            return undefined;
        }
    };

    for (const mixin of mixins) {
        copyLayerMembers(target, mixin(empty).prototype);
    }
}

export { installMixins, type MixinReceiver, type Mixin };
