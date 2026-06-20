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
    obj: GObject.Object;
    signal: string;
    handler?: SignalHandler | null | undefined;
    blockable?: boolean | undefined;
}

export class SignalStore {
    private ownerHandlers: Map<object, Map<GObject.Object, Map<string, SignalHandler>>> = new Map();
    private blockDepth = 0;

    private getObjectMap(owner: object, obj: GObject.Object): Map<string, SignalHandler> {
        let ownerMap = this.ownerHandlers.get(owner);
        if (!ownerMap) {
            ownerMap = new Map();
            this.ownerHandlers.set(owner, ownerMap);
        }
        let objMap = ownerMap.get(obj);
        if (!objMap) {
            objMap = new Map();
            ownerMap.set(obj, objMap);
        }
        return objMap;
    }

    private wrapHandler(
        handler: SignalHandler,
        signal: string,
        obj: GObject.Object,
        blockable: boolean,
    ): SignalHandler {
        return (...args: unknown[]) => {
            if (this.blockDepth > 0 && blockable && !LIFECYCLE_SIGNALS.has(signal)) {
                return;
            }
            this.blockAll();
            try {
                return handler(...args, obj);
            } finally {
                this.unblockAll();
            }
        };
    }

    private disconnect(owner: object, obj: GObject.Object, signal: string): void {
        const ownerMap = this.ownerHandlers.get(owner);
        const objMap = ownerMap?.get(obj);
        const wrappedHandler = objMap?.get(signal);

        if (wrappedHandler !== undefined) {
            obj.off(signal, wrappedHandler);
            objMap?.delete(signal);
            if (objMap?.size === 0) {
                ownerMap?.delete(obj);
            }
        }
    }

    private connect(binding: SignalBinding & { handler: SignalHandler; blockable: boolean }): void {
        const { owner, obj, signal, handler, blockable } = binding;
        const wrappedHandler = this.wrapHandler(handler, signal, obj, blockable);
        obj.on(signal, wrappedHandler);
        this.getObjectMap(owner, obj).set(signal, wrappedHandler);
    }

    public set(binding: SignalBinding): void {
        const { owner, obj, signal, handler, blockable = true } = binding;
        this.disconnect(owner, obj, signal);

        if (handler) {
            this.connect({ owner, obj, signal, handler, blockable });
        }
    }

    public clear(owner: object): void {
        const ownerMap = this.ownerHandlers.get(owner);

        if (ownerMap) {
            for (const [obj, objMap] of ownerMap) {
                for (const [signal, wrappedHandler] of objMap) {
                    obj.off(signal, wrappedHandler);
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
