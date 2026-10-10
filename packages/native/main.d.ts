export {
    addLogListener,
    alloc,
    bind,
    bindField,
    bindFunctionPointer,
    bindVfunc,
    call,
    copy,
    getFundamentalIdentity,
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
    readField,
    readFunctionPointer,
    registerClass,
    removeLogListener,
    resolveFunction,
    resolveFunctionOptional,
    setWrapper,
    setWrapperBorrow,
    writeField,
} from "./index.js";
export type {
    ArrayKind,
    BindVfuncOptions,
    CallbackFailure,
    CallbackScope,
    CallDescriptor,
    CallLayout,
    CallOutput,
    CallResult,
    DecodedCallback,
    Descriptor,
    DestroyNotifyKind,
    ElementOwnership,
    ExternalObject,
    FieldDescriptor,
    FundamentalIdentity,
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
     * Produced by `alloc` and consumed by the memory and wrapper functions (`readField`, `writeField`,
     * `copy`, `getType`, `getWrapper`, `setWrapper`). Its bytes are not accessible from JavaScript.
     */
    export type Handle = { _opaque: "Handle" };
    /**
     * An opaque, precompiled binding of a native function, produced by `bind` and passed to `call`.
     * It stores the target symbol and argument/return marshalling; the symbol resolves on first call.
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
