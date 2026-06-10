import {
    disconnectSignalHandler,
    findListenerHandlerId,
    type Listener,
    trackListener,
    untrackListener,
} from "@gtkx/ffi";
import { Object as GObject } from "@gtkx/gi/gobject/gobject.js";

declare module "@gtkx/gi/gobject/gobject.js" {
    interface Object {
        /**
         * Runtime GType of the underlying GObject, stamped onto every instance
         * at construction time and when a native handle is wrapped. Reflects
         * the concrete leaf type, which may be more derived than the static
         * wrapper type the instance is referenced through.
         */
        __gtype__: number;

        /**
         * Disconnects a signal handler previously connected via
         * {@link Object.connect}, {@link Object.on}, or {@link Object.once}.
         *
         * @param handlerId - The handler ID returned by `connect`/`on`/`once`
         */
        disconnect(handlerId: number): void;

        /**
         * Connects a callback to a signal.
         *
         * Equivalent to {@link Object.connect}, but tracks the callback so it
         * can be later removed via {@link Object.off} without needing the
         * handler ID.
         *
         * @param sigName - The signal name
         * @param callback - The callback function
         * @param after - If true, run after the default handler
         * @returns This object, for EventEmitter-style chaining
         */
        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        on(sigName: string, callback: (...args: any[]) => any, after?: boolean): Object;

        /**
         * Like {@link Object.on}, but the handler is automatically disconnected
         * after the first emission.
         */
        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        once(sigName: string, callback: (...args: any[]) => any, after?: boolean): Object;

        /**
         * Disconnects a callback previously registered with
         * {@link Object.on} or {@link Object.once}.
         *
         * @param sigName - The signal name
         * @param callback - The exact callback reference passed to `on`/`once`
         * @returns This object, for EventEmitter-style chaining
         */
        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        off(sigName: string, callback: (...args: any[]) => any): Object;

        /**
         * Alias of {@link Object.on}, mirroring node-gtk's DOM-style surface.
         */
        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        addEventListener(sigName: string, callback: (...args: any[]) => any, after?: boolean): Object;

        /**
         * Alias of {@link Object.off}, mirroring node-gtk's DOM-style surface.
         */
        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        removeEventListener(sigName: string, callback: (...args: any[]) => any): Object;
    }
}

/**
 * The subset of the {@link GObject} surface the EventEmitter-style impls
 * rely on: the generated `connect` primitive plus the augmented members
 * (`disconnect`, `on`, `once`, `off`) declared above. Extending `GObject`
 * keeps `this` assignable to the declared method types so the prototype
 * assignments need no cast.
 */
type GObjectWithConnect = GObject & {
    connect(sigName: string, callback: Listener, after?: boolean): number;
};

GObject.prototype.disconnect = function disconnect(handlerId: number): void {
    disconnectSignalHandler(this, handlerId);
};

function onImpl(this: GObjectWithConnect, sigName: string, callback: Listener, after?: boolean): GObject {
    const handlerId = this.connect(sigName, callback, after);
    trackListener(this, sigName, callback, handlerId);
    return this;
}
GObject.prototype.on = onImpl;

function onceImpl(this: GObjectWithConnect, sigName: string, callback: Listener, after?: boolean): GObject {
    let handlerId = 0;
    const wrapped: Listener = (...args: unknown[]) => {
        untrackListener(this, sigName, wrapped);
        untrackListener(this, sigName, callback);
        this.disconnect(handlerId);
        return callback(...args);
    };
    handlerId = this.connect(sigName, wrapped, after);
    trackListener(this, sigName, wrapped, handlerId);
    trackListener(this, sigName, callback, handlerId);
    return this;
}
GObject.prototype.once = onceImpl;

function offImpl(this: GObjectWithConnect, sigName: string, callback: Listener): GObject {
    const handlerId = findListenerHandlerId(this, sigName, callback);
    if (handlerId !== undefined) {
        this.disconnect(handlerId);
        untrackListener(this, sigName, callback);
    }
    return this;
}
GObject.prototype.off = offImpl;

GObject.prototype.addEventListener = onImpl;
GObject.prototype.removeEventListener = offImpl;
