import * as GObject from "@gtkx/ffi/gobject";

type SignalHandlerMap = Map<string, number>;

export const disconnectSignalHandlers = (gobject: GObject.GObject, handlers: SignalHandlerMap): void => {
    for (const handlerId of handlers.values()) {
        GObject.signalHandlerDisconnect(gobject, handlerId);
    }
    handlers.clear();
};
