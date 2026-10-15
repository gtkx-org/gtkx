export {
    alloc,
    bindFunction,
    call,
    copy,
    createFunction,
    createMatchSubject,
    createRecordConverter,
    createReferenceStorage,
    emitSignal,
    getFundamentalIdentity,
    getMatchInfoBase,
    getMatchInfoType,
    getObjectProperty,
    getType,
    getTypeClass,
    getWrapper,
    init,
    installLogSink,
    logSubscriptionFence,
    newObject,
    openLibrary,
    ownMatchInfo,
    quit,
    readField,
    registerClass,
    resolveSymbol,
    setObjectProperty,
    setValuePointer,
    setWrapper,
    setWrapperBorrow,
    writeField,
} from "./index.js";
export type {
    ArrayKind,
    CallbackFailure,
    CallbackOptions,
    CallbackScope,
    CallLayout,
    CallOutput,
    CallResult,
    DecodedCallback,
    Descriptor,
    DestroyNotifyKind,
    ElementOwnership,
    ExternalObject,
    FundamentalIdentity,
    FunctionOptions,
    FunctionSignature,
    Handle,
    LibraryHandle,
    Ownership,
    RecordConverter,
    RecordConverterOptions,
    ReferenceMode,
    ReferenceStorage,
    Ref,
    RegisterClassInterface,
    RegisterClassOptions,
    RegisterClassVfunc,
    TypeClassOptions,
} from "./index.js";

declare module "./index.js" {
    /**
     * An opaque handle to a native memory region: a GObject, a boxed value, or a raw allocation.
     * Produced by `alloc` and consumed by the memory and wrapper functions (`readField`, `writeField`,
     * `copy`, `getType`, `getWrapper`, `setWrapper`). Its bytes are not accessible from JavaScript.
     */
    export type Handle = { _opaque: "Handle" };
    /** A compiled ABI signature and marshalling plan shared by calls and callback trampolines. */
    export type FunctionSignature = { _opaque: "FunctionSignature" };
    /** A reference to a shared library that remains loaded for the life of the process. */
    export type LibraryHandle = { _opaque: "LibraryHandle" };
    /** A native record copy strategy with lazily resolved lifecycle operations. */
    export type RecordConverter = { _opaque: "RecordConverter" };
    /** An owned reference seed prepared for one argument of a compiled call signature. */
    export type ReferenceStorage = { _opaque: "ReferenceStorage" };
    export type Ref = { value: unknown };
    export type CallbackFailure = { nativeError: ExternalObject<Handle>; thrown: unknown };
}
