import { getObjectId } from "@gtkx/ffi";
import * as GObject from "@gtkx/ffi/gobject";
import { scheduleAfterCommit } from "../../scheduler.js";

// biome-ignore lint/suspicious/noExplicitAny: ignore
export type SignalHandler = (...args: any[]) => any;

export class SignalStore {
    private signalHandlers: Map<string, { obj: GObject.GObject; handlerId: number }> = new Map();

    public disconnect(obj: GObject.GObject, signal: string): void {
        const objectId = getObjectId(obj.id);
        const key = `${objectId}:${signal}`;
        const existing = this.signalHandlers.get(key);

        if (existing) {
            GObject.signalHandlerDisconnect(existing.obj, existing.handlerId);
            this.signalHandlers.delete(key);
        }
    }

    public connect(obj: GObject.GObject, signal: string, handler: SignalHandler): void {
        const objectId = getObjectId(obj.id);
        const key = `${objectId}:${signal}`;
        const handlerId = obj.connect(signal, handler);
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

    public block(fn: () => void): void {
        const handlers = new Map(this.signalHandlers);

        for (const [, { obj, handlerId }] of handlers) {
            GObject.signalHandlerBlock(obj, handlerId);
        }

        fn();

        scheduleAfterCommit(() => {
            for (const [key, { obj, handlerId }] of handlers) {
                if (this.signalHandlers.has(key)) {
                    GObject.signalHandlerUnblock(obj, handlerId);
                }
            }
        });
    }
}
