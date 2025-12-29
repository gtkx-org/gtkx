import { getObjectId } from "@gtkx/ffi";
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

class SignalStore {
    private ownerHandlers: Map<SignalOwner, Map<string, HandlerEntry>> = new Map();
    private blockedHandlers: Set<number> = new Set();

    private getOwnerMap(owner: SignalOwner): Map<string, HandlerEntry> {
        let map = this.ownerHandlers.get(owner);
        if (!map) {
            map = new Map();
            this.ownerHandlers.set(owner, map);
        }
        return map;
    }

    private disconnect(owner: SignalOwner, obj: GObject.GObject, signal: string): void {
        const objectId = getObjectId(obj.id);
        const key = `${objectId}:${signal}`;
        const ownerMap = this.ownerHandlers.get(owner);
        const existing = ownerMap?.get(key);

        if (existing) {
            GObject.signalHandlerDisconnect(existing.obj, existing.handlerId);
            ownerMap?.delete(key);
        }
    }

    private connect(owner: SignalOwner, obj: GObject.GObject, signal: string, handler: SignalHandler): void {
        const objectId = getObjectId(obj.id);
        const key = `${objectId}:${signal}`;
        const handlerId = obj.connect(signal, handler);
        this.getOwnerMap(owner).set(key, { obj, handlerId });
    }

    public set(owner: SignalOwner, obj: GObject.GObject, signal: string, handler?: SignalHandler): void {
        this.disconnect(owner, obj, signal);

        if (handler) {
            this.connect(owner, obj, signal, handler);
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
        this.blockedHandlers.clear();

        for (const ownerMap of this.ownerHandlers.values()) {
            for (const [key, { obj, handlerId }] of ownerMap.entries()) {
                if (LIFECYCLE_SIGNALS.has(key.split(":")[1] ?? "")) {
                    continue;
                }

                GObject.signalHandlerBlock(obj, handlerId);
                this.blockedHandlers.add(handlerId);
            }
        }
    }

    public unblockAll(): void {
        for (const ownerMap of this.ownerHandlers.values()) {
            for (const { obj, handlerId } of ownerMap.values()) {
                if (this.blockedHandlers.has(handlerId)) {
                    GObject.signalHandlerUnblock(obj, handlerId);
                }
            }
        }

        this.blockedHandlers.clear();
    }
}

export const signalStore = new SignalStore();
