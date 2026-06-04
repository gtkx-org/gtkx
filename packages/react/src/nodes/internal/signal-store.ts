import type { SignalHandler } from "@gtkx/ffi";
import * as GObject from "@gtkx/gi/gobject";

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
    "setup",
    "bind",
    "unbind",
    "teardown",
]);

/**
 * Parameter object for {@link SignalStore.set}.
 *
 */
export interface SignalBinding {
    readonly owner: object;
    readonly obj: GObject.Object;
    readonly signal: string;
    readonly handler?: SignalHandler | null;
    readonly blockable?: boolean;
}

export class SignalStore {
    private readonly ownerHandlers: Map<object, Map<GObject.Object, Map<string, number>>> = new Map();
    private blockDepth = 0;

    private getObjectMap(owner: object, obj: GObject.Object): Map<string, number> {
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
        const handlerId = objMap?.get(signal);

        if (handlerId !== undefined) {
            GObject.signalHandlerDisconnect(obj, handlerId);
            objMap?.delete(signal);
            if (objMap?.size === 0) {
                ownerMap?.delete(obj);
            }
        }
    }

    private connect(binding: SignalBinding & { handler: SignalHandler; blockable: boolean }): void {
        const { owner, obj, signal, handler, blockable } = binding;
        const wrappedHandler = this.wrapHandler(handler, signal, obj, blockable);
        const handlerId = obj.connect(signal, wrappedHandler);
        this.getObjectMap(owner, obj).set(signal, handlerId);
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
                for (const handlerId of objMap.values()) {
                    GObject.signalHandlerDisconnect(obj, handlerId);
                }
            }

            this.ownerHandlers.delete(owner);
        }
    }

    public blockAll(): void {
        this.blockDepth++;
    }

    /**
     * Decrements the block depth, but absorbs the underflow that occurs when
     * an error-recovery path has reset the depth to zero between the matching
     * `blockAll` and this call — see `render.tsx`, which calls
     * {@link forceUnblockAll} on commit failure to release stuck signals
     * before any pending `unblockAll` runs.
     */
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
