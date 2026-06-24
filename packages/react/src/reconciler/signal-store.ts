import type { SignalHandler } from "@gtkx/ffi";
import type * as GObject from "@gtkx/gi/gobject";

export type { SignalHandler };

const LIFECYCLE_SIGNALS = new Set([
    "realize",
    "unrealize",
    "map",
    "unmap",
    "show",
    "hide",
    "destroy",
    "resize",
    "render",
]);

export interface SignalBinding {
    owner: object;
    instance: GObject.Object;
    signal: string;
    handler?: SignalHandler | null | undefined;
    blockable?: boolean | undefined;
}

export class SignalStore {
    private ownerHandlers: Map<object, Map<GObject.Object, Map<string, number>>> = new Map();
    private blockDepth = 0;

    private getInstanceMap(owner: object, instance: GObject.Object): Map<string, number> {
        let ownerMap = this.ownerHandlers.get(owner);
        if (!ownerMap) {
            ownerMap = new Map();
            this.ownerHandlers.set(owner, ownerMap);
        }
        let instanceMap = ownerMap.get(instance);
        if (!instanceMap) {
            instanceMap = new Map();
            ownerMap.set(instance, instanceMap);
        }
        return instanceMap;
    }

    private wrapCallback(
        handler: SignalHandler,
        signal: string,
        instance: GObject.Object,
        blockable: boolean,
    ): SignalHandler {
        return (...args: unknown[]) => {
            if (this.blockDepth > 0 && blockable && !LIFECYCLE_SIGNALS.has(signal)) {
                return;
            }
            this.blockAll();
            try {
                return handler(...args, instance);
            } finally {
                this.unblockAll();
            }
        };
    }

    private disconnect(owner: object, instance: GObject.Object, signal: string): void {
        const ownerMap = this.ownerHandlers.get(owner);
        const instanceMap = ownerMap?.get(instance);
        const handlerId = instanceMap?.get(signal);

        if (handlerId !== undefined) {
            instance.disconnect(handlerId);
            instanceMap?.delete(signal);
            if (instanceMap?.size === 0) {
                ownerMap?.delete(instance);
            }
        }
    }

    private connect(binding: SignalBinding & { handler: SignalHandler; blockable: boolean }): void {
        const { owner, instance, signal, handler, blockable } = binding;
        const wrappedHandler = this.wrapCallback(handler, signal, instance, blockable);
        const handlerId = instance.connect(signal, wrappedHandler);
        this.getInstanceMap(owner, instance).set(signal, handlerId);
    }

    public set(binding: SignalBinding): void {
        const { owner, instance, signal, handler, blockable = true } = binding;
        this.disconnect(owner, instance, signal);

        if (handler) {
            this.connect({ owner, instance, signal, handler, blockable });
        }
    }

    public clear(owner: object): void {
        const ownerMap = this.ownerHandlers.get(owner);

        if (ownerMap) {
            for (const [instance, instanceMap] of ownerMap) {
                for (const [, handlerId] of instanceMap) {
                    instance.disconnect(handlerId);
                }
            }

            this.ownerHandlers.delete(owner);
        }
    }

    public blockAll(): void {
        this.blockDepth++;
    }

    public unblockAll(): void {
        if (this.blockDepth > 0) {
            this.blockDepth--;
        }
    }

    public forceUnblockAll(): void {
        this.blockDepth = 0;
    }
}

const signalStores = new WeakMap<object, SignalStore>();

export function getSignalStore(rootContainer: object): SignalStore {
    let store = signalStores.get(rootContainer);
    if (!store) {
        store = new SignalStore();
        signalStores.set(rootContainer, store);
    }
    return store;
}
