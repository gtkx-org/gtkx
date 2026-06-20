import { offSignal, onceSignal, onSignal } from "@gtkx/ffi";
import { Object as GObject, type GType, signalHandlerDisconnect } from "../gobject.js";

// biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
type Listener = (...args: any[]) => any;

declare module "../gobject.js" {
    interface Object {
        // biome-ignore lint/style/useNamingConvention: GObject runtime type key stamped on every instance
        __gtype__: GType;

        disconnect(handlerId: number): void;

        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        on(sigName: string, callback: (...args: any[]) => any, after?: boolean): Object;

        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        once(sigName: string, callback: (...args: any[]) => any, after?: boolean): Object;

        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        off(sigName: string, callback: (...args: any[]) => any): Object;

        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        addEventListener(sigName: string, callback: (...args: any[]) => any, after?: boolean): Object;

        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        removeEventListener(sigName: string, callback: (...args: any[]) => any): Object;
    }
}

type GObjectWithConnect = GObject & {
    connect(sigName: string, callback: Listener, after?: boolean): number;
};

GObject.prototype.disconnect = function disconnect(handlerId: number): void {
    signalHandlerDisconnect(this, handlerId);
};

function onImpl(this: GObjectWithConnect, sigName: string, callback: Listener, after?: boolean): GObject {
    onSignal(this, sigName, callback, after);
    return this;
}
GObject.prototype.on = onImpl;

function onceImpl(this: GObjectWithConnect, sigName: string, callback: Listener, after?: boolean): GObject {
    onceSignal(this, sigName, callback, after);
    return this;
}
GObject.prototype.once = onceImpl;

function offImpl(this: GObjectWithConnect, sigName: string, callback: Listener): GObject {
    offSignal(this, sigName, callback);
    return this;
}
GObject.prototype.off = offImpl;

GObject.prototype.addEventListener = onImpl;
GObject.prototype.removeEventListener = offImpl;
