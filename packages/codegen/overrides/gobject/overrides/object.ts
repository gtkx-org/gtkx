import {
    disconnectSignal,
    offSignal,
    onceSignal,
    onSignal,
    type SignalHandler,
    type SignalHandlerId,
} from "@gtkx/runtime";
import type { SignalMap, SignalMethodReceiver, SignalName } from "@gtkx/runtime/internal";
import { Object as GObject } from "../gobject.js";

declare module "../gobject.js" {
    interface Object {
        /** GType the instance's class is registered under, carried on the prototype. */
        __type__: Type;

        /**
         * Disconnects the handler `connect` returned the given id for.
         *
         * @param handlerId Id of the handler to disconnect.
         */
        disconnect<TThis>(this: TThis & SignalMethodReceiver<TThis, "disconnect">, handlerId: SignalHandlerId): void;

        /**
         * Connects a handler that runs on every emission of `sigName`, remembering it so `off` can
         * take the same callback back off again.
         *
         * @param sigName Signal to connect to.
         * @param callback Handler invoked on each emission.
         * @param isAfter Run the handler after the default handler rather than before it.
         * @returns The same object, so calls chain.
         */
        on<TThis, K extends SignalName<TThis>>(
            this: TThis & SignalMethodReceiver<TThis, "on">,
            sigName: K,
            callback: SignalMap<TThis>[K],
            isAfter?: boolean,
        ): TThis;

        /**
         * Connects a handler that runs at most once and disconnects itself after the first emission.
         *
         * @param sigName Signal to connect to.
         * @param callback Handler invoked on the first emission.
         * @param isAfter Run the handler after the default handler rather than before it.
         * @returns The same object, so calls chain.
         */
        once<TThis, K extends SignalName<TThis>>(
            this: TThis & SignalMethodReceiver<TThis, "once">,
            sigName: K,
            callback: SignalMap<TThis>[K],
            isAfter?: boolean,
        ): TThis;

        /**
         * Disconnects a handler previously connected with `on` or `once`, given the same callback.
         *
         * @param sigName Signal the handler was connected to.
         * @param callback The handler that was connected.
         * @returns The same object, so calls chain.
         */
        off<TThis, K extends SignalName<TThis>>(
            this: TThis & SignalMethodReceiver<TThis, "off">,
            sigName: K,
            callback: SignalMap<TThis>[K],
        ): TThis;
    }
}

GObject.prototype.disconnect = function (this: GObject, handlerId: SignalHandlerId): void {
    disconnectSignal(this, handlerId);
};

GObject.prototype.on = function <TThis extends object>(
    this: TThis,
    signal: string,
    handler: SignalHandler,
    isAfter?: boolean,
): TThis {
    onSignal(this, signal, handler, isAfter);

    return this;
};

GObject.prototype.once = function <TThis extends object>(
    this: TThis,
    signal: string,
    handler: SignalHandler,
    isAfter?: boolean,
): TThis {
    onceSignal(this, signal, handler, isAfter);

    return this;
};

GObject.prototype.off = function <TThis extends object>(this: TThis, signal: string, handler: SignalHandler): TThis {
    offSignal(this, signal, handler);

    return this;
};
