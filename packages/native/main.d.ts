export {
    alloc,
    bindField,
    call,
    compileCall,
    compileVfuncSlot,
    copy,
    createCallback,
    createClosure,
    createMatchSubject,
    createFunctionResolver,
    createRecordConverter,
    createReferenceStorage,
    createTypeResolver,
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
    keepAlive,
    newObject,
    openLibrary,
    ownMatchInfo,
    quit,
    readField,
    readVfuncSlot,
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
    CallbackScope,
    CallSignature,
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
    FunctionResolver,
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
    TypeResolver,
    VfuncSlot,
    VfuncSlotOptions,
} from "./index.js";

declare module "./index.js" {
    /**
     * An opaque handle to a native memory region: a GObject, a boxed value, or a raw allocation.
     * Produced by `alloc` and consumed by the memory and wrapper functions (`readField`, `writeField`,
     * `copy`, `getType`, `getWrapper`, `setWrapper`). Its bytes are not accessible from JavaScript.
     */
    export type Handle = { _opaque: "Handle" };
    /** An ABI signature compiled independently of its executable target. */
    export type CallSignature = { _opaque: "CallSignature" };
    /** A reference to a shared library that remains loaded for the life of the process. */
    export type LibraryHandle = { _opaque: "LibraryHandle" };
    /** A validated vtable position whose implementation is acquired when read. */
    export type VfuncSlot = { _opaque: "VfuncSlot" };
    /** An environment-bound lazy GType resolver that retries unregistered types. */
    export type TypeResolver = { _opaque: "TypeResolver" };
    /** An environment-bound lazy resolver for a permanent native lifecycle function. */
    export type FunctionResolver = { _opaque: "FunctionResolver" };
    /** A native record copy strategy with lazily resolved lifecycle operations. */
    export type RecordConverter = { _opaque: "RecordConverter" };
    /** An owned reference seed prepared for one argument of a compiled call signature. */
    export type ReferenceStorage = { _opaque: "ReferenceStorage" };
    /**
     * An opaque, precompiled binding of a struct field, produced by `bindField` and passed to
     * `readField` and `writeField`. It captures the marshalling of the field's bytes; the byte
     * offset the field sits at within its owner's memory is given on every access.
     */
    export type FieldDescriptor = { _opaque: "FieldDescriptor" };
    export type Ref = { value: unknown };
    export type CallbackFailure = { nativeError: ExternalObject<Handle>; thrown: unknown };
}
