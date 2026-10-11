export {
    alloc,
    attachCall,
    bindField,
    call,
    compileCall,
    compileReference,
    compileVfuncSlot,
    copy,
    createFunctionResolver,
    createRecordConverter,
    createReferenceStorage,
    createTypeResolver,
    disposeHandle,
    getFundamentalIdentity,
    getMatchInfoBase,
    getMatchInfoType,
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
    readFunctionPointer,
    readReferenceStorage,
    readVfuncSlot,
    registerClass,
    resolveSymbol,
    setWrapper,
    setWrapperBorrow,
    writeField,
    writeReferenceStorage,
} from "./index.js";
export type {
    ArrayKind,
    CallbackFailure,
    CallbackScope,
    CallDescriptor,
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
    ReferenceDescriptor,
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
    /**
     * An opaque binding of a compiled signature to an owned executable handle, passed to `call`.
     */
    export type CallDescriptor = { _opaque: "CallDescriptor" };
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
    /** A synchronous record acquisition callback invoked while native source storage is leased. */
    export type RecordConverter = { _opaque: "RecordConverter" };
    /** A compiled non-scalar reference layout, paired with storage prepared for that layout. */
    export type ReferenceDescriptor = { _opaque: "ReferenceDescriptor" };
    /** An owned call transaction or a scoped callback output slot. */
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
