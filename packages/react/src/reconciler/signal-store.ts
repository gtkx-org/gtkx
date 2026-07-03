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

export type SignalBinding = {
    instance: GObject.Object;
    signal: string;
    handler?: SignalHandler | null | undefined;
    blockable?: boolean | undefined;
};

export class SignalStore {
    private instanceHandlers: Map<GObject.Object, Map<string, number>> = new Map();
    private blockDepth = 0;

    private getInstanceMap(instance: GObject.Object): Map<string, number> {
        let instanceMap = this.instanceHandlers.get(instance);
        if (!instanceMap) {
            instanceMap = new Map();
            this.instanceHandlers.set(instance, instanceMap);
        }
        return instanceMap;
    }

    private gateHandler(
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

    private disconnect(instance: GObject.Object, signal: string): void {
        const instanceMap = this.instanceHandlers.get(instance);
        const handlerId = instanceMap?.get(signal);

        if (handlerId !== undefined) {
            instance.disconnect(handlerId);
            instanceMap?.delete(signal);
            if (instanceMap?.size === 0) {
                this.instanceHandlers.delete(instance);
            }
        }
    }

    private connect(binding: SignalBinding & { handler: SignalHandler; blockable: boolean }): void {
        const { instance, signal, handler, blockable } = binding;
        const gatedHandler = this.gateHandler(handler, signal, instance, blockable);
        const handlerId = instance.connect(signal, gatedHandler);
        this.getInstanceMap(instance).set(signal, handlerId);
    }

    public set(binding: SignalBinding): void {
        const { instance, signal, handler, blockable = true } = binding;
        this.disconnect(instance, signal);

        if (handler) {
            this.connect({ instance, signal, handler, blockable });
        }
    }

    public clear(instance: GObject.Object): void {
        const instanceMap = this.instanceHandlers.get(instance);

        if (instanceMap) {
            for (const [, handlerId] of instanceMap) {
                instance.disconnect(handlerId);
            }

            this.instanceHandlers.delete(instance);
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
