import type * as GObject from "@gtkx/gi/gobject";
import type { SignalHandler } from "@gtkx/runtime";
import { getOrInsert } from "@gtkx/utils";

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

type SignalBinding = {
    instance: GObject.Object;
    signal: string;
    handler?: SignalHandler | undefined;
};

export class SignalStore {
    private instanceHandlers: Map<GObject.Object, Map<string, number>> = new Map();

    private blockDepth: number = 0;

    private ensureInstanceMap(instance: GObject.Object): Map<string, number> {
        return getOrInsert(this.instanceHandlers, instance, () => new Map());
    }

    private gateHandler(handler: SignalHandler, signal: string, instance: GObject.Object): SignalHandler {
        return (...args: unknown[]) => {
            if (this.blockDepth > 0 && !UNBLOCKED_SIGNALS.has(signal)) {
                return;
            }
            return handler(...args, instance);
        };
    }

    private disconnect(instance: GObject.Object, signal: string): void {
        const instanceMap = this.instanceHandlers.get(instance);
        if (!instanceMap) return;
        const handlerId = instanceMap.get(signal);
        if (handlerId === undefined) return;
        instance.disconnect(handlerId);
        instanceMap.delete(signal);
        if (instanceMap.size === 0) this.instanceHandlers.delete(instance);
    }

    private connect(binding: SignalBinding & { handler: SignalHandler }): void {
        const { instance, signal, handler } = binding;
        const gatedHandler = this.gateHandler(handler, signal, instance);
        const handlerId = instance.connect(signal, gatedHandler);
        this.ensureInstanceMap(instance).set(signal, handlerId);
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
        this.blockDepth += 1;
    }

    public unblock(): void {
        if (this.blockDepth > 0) this.blockDepth -= 1;
    }
}

const signalStores = new WeakMap<object, SignalStore>();

export function ensureSignalStore(rootContainer: object): SignalStore {
    return getOrInsert(signalStores, rootContainer, () => new SignalStore());
}
