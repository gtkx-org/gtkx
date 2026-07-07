import type { SignalHandler } from "@gtkx/ffi";
import type * as GObject from "@gtkx/gi/gobject";

const UNBLOCKED_SIGNALS = new Set([
    "realize",
    "unrealize",
    "map",
    "unmap",
    "show",
    "hide",
    "destroy",
    "resize",
    "render",
    "input",
    "output",
]);

let blockDepth = 0;

type SignalBinding = {
    instance: GObject.Object;
    signal: string;
    handler?: SignalHandler | null | undefined;
};

export class SignalStore {
    private instanceHandlers: Map<GObject.Object, Map<string, number>> = new Map();

    private getInstanceMap(instance: GObject.Object): Map<string, number> {
        let instanceMap = this.instanceHandlers.get(instance);
        if (!instanceMap) {
            instanceMap = new Map();
            this.instanceHandlers.set(instance, instanceMap);
        }
        return instanceMap;
    }

    private gateHandler(handler: SignalHandler, signal: string, instance: GObject.Object): SignalHandler {
        return (...args: unknown[]) => {
            if (blockDepth > 0 && !UNBLOCKED_SIGNALS.has(signal)) {
                return;
            }
            return handler(...args, instance);
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

    private connect(binding: SignalBinding & { handler: SignalHandler }): void {
        const { instance, signal, handler } = binding;
        const gatedHandler = this.gateHandler(handler, signal, instance);
        const handlerId = instance.connect(signal, gatedHandler);
        this.getInstanceMap(instance).set(signal, handlerId);
    }

    public set(binding: SignalBinding): void {
        const { instance, signal, handler } = binding;
        this.disconnect(instance, signal);

        if (handler) {
            this.connect({ instance, signal, handler });
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

    public block(): void {
        blockDepth += 1;
    }

    public unblock(): void {
        if (blockDepth > 0) blockDepth -= 1;
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
