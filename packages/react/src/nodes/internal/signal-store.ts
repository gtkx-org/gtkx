import { getNativeId } from "@gtkx/ffi";
import * as GObject from "@gtkx/ffi/gobject";

type SignalOwner = object;

// biome-ignore lint/suspicious/noExplicitAny: Required for contravariant behavior
export type SignalHandler = (...args: any[]) => any;

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

type HandlerEntry = { obj: GObject.GObject; handlerId: number };

export interface SignalOptions {
    blockable?: boolean;
}

export class SignalStore {
    private ownerHandlers: Map<SignalOwner, Map<string, HandlerEntry>> = new Map();
    private blockDepth = 0;

    private getOwnerMap(owner: SignalOwner): Map<string, HandlerEntry> {
        let map = this.ownerHandlers.get(owner);
        if (!map) {
            map = new Map();
            this.ownerHandlers.set(owner, map);
        }
        return map;
    }

    private wrapHandler(handler: SignalHandler, signal: string, blockable: boolean): SignalHandler {
        return (...args: unknown[]) => {
            if (this.blockDepth > 0 && blockable && !LIFECYCLE_SIGNALS.has(signal)) {
                return;
            }
            const [self, ...rest] = args;
            return handler(...rest, self);
        };
    }

    private disconnect(owner: SignalOwner, obj: GObject.GObject, signal: string): void {
        const objectId = getNativeId(obj.handle);
        const key = `${objectId}:${signal}`;
        const ownerMap = this.ownerHandlers.get(owner);
        const existing = ownerMap?.get(key);

        if (existing) {
            GObject.signalHandlerDisconnect(existing.obj, existing.handlerId);
            ownerMap?.delete(key);
        }
    }

    private connect(
        owner: SignalOwner,
        obj: GObject.GObject,
        signal: string,
        handler: SignalHandler,
        blockable: boolean,
    ): void {
        const objectId = getNativeId(obj.handle);
        const key = `${objectId}:${signal}`;
        const wrappedHandler = this.wrapHandler(handler, signal, blockable);
        const handlerId = obj.connect(signal, wrappedHandler);
        this.getOwnerMap(owner).set(key, { obj, handlerId });
    }

    public set(
        owner: SignalOwner,
        obj: GObject.GObject,
        signal: string,
        handler?: SignalHandler | null,
        options?: SignalOptions,
    ): void {
        this.disconnect(owner, obj, signal);

        if (handler) {
            this.connect(owner, obj, signal, handler, options?.blockable ?? true);
        }
    }

    public clear(owner: SignalOwner): void {
        const ownerMap = this.ownerHandlers.get(owner);

        if (ownerMap) {
            for (const { obj, handlerId } of ownerMap.values()) {
                GObject.signalHandlerDisconnect(obj, handlerId);
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
