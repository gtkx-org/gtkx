import { type ExternalObject, getType, type Handle } from "@gtkx/native";
import { bind } from "./bind.js";
import { biguint64T, booleanT, bufferT, callbackT, objectT, stringT, uint32T, voidT } from "./descriptors.js";
import { LIB } from "./library.js";
import { getHandle } from "./registry.js";
import type { SignalHandlerId } from "./signal.js";
import { TYPE_INVALID } from "./type.js";

type NativeHandle = ExternalObject<Handle>;

const findHandler = bind(
    LIB,
    "g_signal_handler_find",
    [bufferT, uint32T, uint32T, uint32T, bufferT, bufferT, bufferT],
    biguint64T,
);
const disconnectHandler = bind(LIB, "g_signal_handler_disconnect", [bufferT, biguint64T], voidT);
const isConnected = bind(LIB, "g_signal_handler_is_connected", [bufferT, biguint64T], booleanT);
const SIGNAL_CALLBACK = callbackT([{ ...objectT(), isCallScoped: true }, bufferT], voidT, {
    hasUserData: true,
    userDataIndex: 1,
    hasDestroy: true,
    destroyKind: "closureNotify",
    scope: "notified",
});
const connectSignal = bind(
    LIB,
    "g_signal_connect_data",
    [objectT(), stringT("borrowed"), SIGNAL_CALLBACK, uint32T],
    biguint64T,
);

const isNativeHandleAlive = (handle: NativeHandle): boolean => getType(handle) !== TYPE_INVALID;

/** Finds a native signal handler whose user-data pointer matches the supplied handle. */
function findNativeSignalHandler(
    instance: NativeHandle,
    mask: number,
    signal: number,
    detail: number,
    data: NativeHandle,
): SignalHandlerId {
    return findHandler(instance, mask, signal, detail, null, null, data) as SignalHandlerId;
}

/** Disconnects surviving native handlers without creating or retaining their emitter's wrapper. */
function disconnectNativeSignalHandlers(handle: NativeHandle, ids: Iterable<SignalHandlerId>): void {
    if (!isNativeHandleAlive(handle)) {
        return;
    }

    for (const id of ids) {
        if (isConnected(handle, id)) {
            disconnectHandler(handle, id);
        }
    }
}

/** Connects a zero-argument native signal whose callback must outlive the emitter's wrapper. */
function connectNativeSignal(instance: object, signal: string, handler: () => void, flags: number): void {
    connectSignal(getHandle(instance), signal, handler, flags);
}

export {
    connectNativeSignal,
    disconnectNativeSignalHandlers,
    findNativeSignalHandler,
    isNativeHandleAlive,
    type NativeHandle,
};
