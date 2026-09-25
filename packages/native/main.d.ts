export {
    alloc,
    allocField,
    bind,
    bindField,
    bindFunctionPointer,
    bindVfunc,
    call,
    copy,
    getFundamentalWrapper,
    getMatchInfoBase,
    getMatchInfoType,
    getType,
    getTypeClass,
    getWrapper,
    init,
    keepAlive,
    newObject,
    ownMatchInfo,
    quit,
    read,
    readField,
    readFunctionPointer,
    registerClass,
    resolveFunction,
    resolveType,
    setFundamentalWrapper,
    setWrapper,
    setWrapperBorrow,
    write,
    writeField,
} from "./index.js";
export type {
    ArrayKind,
    BindVfuncOptions,
    CallbackFailure,
    CallbackScope,
    CallDescriptor,
    CallOutput,
    CallResult,
    DecodedCallback,
    Descriptor,
    DestroyNotifyKind,
    ElementOwnership,
    ExternalObject,
    FieldDescriptor,
    Handle,
    Ownership,
    Ref,
    RegisterClassInterface,
    RegisterClassOptions,
    RegisterClassVfunc,
} from "./index.js";

declare module "./index.js" {
    /**
     * An opaque handle to a native memory region: a GObject, a boxed value, or a raw allocation.
     * Produced by `alloc` and consumed by the memory and wrapper functions (`read`, `write`,
     * `copy`, `getType`, `getWrapper`, `setWrapper`). Its bytes are not accessible from JavaScript.
     */
    export type Handle = { _opaque: "Handle" };
    /**
     * An opaque, precompiled binding of a native function, produced by `bind` and passed to `call`.
     * It captures the resolved symbol and the marshalling of its arguments and return value.
     */
    export type CallDescriptor = { _opaque: "CallDescriptor" };
    /**
     * An opaque, precompiled binding of a struct field, produced by `bindField` and passed to
     * `readField` and `writeField`. It captures the marshalling of the field's bytes; the byte
     * offset the field sits at within its owner's memory is given on every access.
     */
    export type FieldDescriptor = { _opaque: "FieldDescriptor" };
    export type Ref = { value: unknown };
    export type CallbackFailure = { nativeError: ExternalObject<Handle>; thrown: unknown };
}

type LogLevel = "error" | "critical" | "warning" | "message" | "info" | "debug";

type LogListener = (level: LogLevel, domain: string, message: string) => void;

type LogSubscription = { unsubscribe(): void };

/**
 * Subscribes `listener` to every GLib log record the process writes, whichever thread logs it,
 * and returns the subscription whose `unsubscribe` removes it again. The listener receives the
 * level name, the log domain and the message. Records are queued to the JavaScript thread and
 * delivered asynchronously, so a check that reads what the listener collected has to yield to the
 * event loop once after the logging call. A level GLib treats as fatal, including one made fatal
 * through `logSetAlwaysFatal`, aborts the process before the queued delivery runs, so such a
 * listener never sees it. `unsubscribe` stops further records from being queued but does not cancel
 * the ones already queued, so the listener can still run for those after `unsubscribe` returns.
 */
declare function onLog(listener: LogListener): LogSubscription;

export { type LogLevel, type LogListener, type LogSubscription, onLog };
