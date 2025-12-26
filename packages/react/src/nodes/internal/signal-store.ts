import { getObjectId } from "@gtkx/ffi";
import * as GObject from "@gtkx/ffi/gobject";
import { isCommitting } from "../../host-config.js";

// biome-ignore lint/suspicious/noExplicitAny: ignore
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
]);

export class SignalStore {
    private signalHandlers: Map<string, { obj: GObject.GObject; handlerId: number }> = new Map();

    private disconnect(obj: GObject.GObject, signal: string): void {
        const objectId = getObjectId(obj.id);
        const key = `${objectId}:${signal}`;
        const existing = this.signalHandlers.get(key);

        if (existing) {
            GObject.signalHandlerDisconnect(existing.obj, existing.handlerId);
            this.signalHandlers.delete(key);
        }
    }

    private connect(obj: GObject.GObject, signal: string, handler: SignalHandler): void {
        const objectId = getObjectId(obj.id);
        const key = `${objectId}:${signal}`;

        const wrappedHandler: SignalHandler = (...args) => {
            if (isCommitting() && !LIFECYCLE_SIGNALS.has(signal)) {
                return;
            }

            return handler(...args);
        };

        const handlerId = obj.connect(signal, wrappedHandler);
        this.signalHandlers.set(key, { obj, handlerId });
    }

    public set(obj: GObject.GObject, signal: string, handler?: SignalHandler): void {
        this.disconnect(obj, signal);

        if (handler) {
            this.connect(obj, signal, handler);
        }
    }

    public clear(): void {
        for (const [_, { obj, handlerId }] of this.signalHandlers) {
            GObject.signalHandlerDisconnect(obj, handlerId);
        }

        this.signalHandlers.clear();
    }
}
