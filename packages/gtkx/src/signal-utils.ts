import { call } from "@gtkx/native";

type SignalHandlerMap = Map<string, number>;

type GObjectLike = { ptr: unknown };

export const disconnectSignalHandlers = (gobject: GObjectLike, handlers: SignalHandlerMap): void => {
    for (const handlerId of handlers.values()) {
        call(
            "libgobject-2.0.so.0",
            "g_signal_handler_disconnect",
            [
                { type: { type: "gobject" }, value: gobject.ptr },
                { type: { type: "int", size: 64, unsigned: true }, value: handlerId },
            ],
            { type: "undefined" },
        );
    }
    handlers.clear();
};
