export {
    alloc,
    bindFunction,
    call,
    compileDescriptor,
    createFunction,
    emitSignal,
    getFundamentalIdentity,
    getObjectProperty,
    getType,
    getTypeClass,
    getWrapper,
    init,
    installLogSink,
    logSubscriptionFence,
    newObject,
    openLibrary,
    quit,
    readField,
    registerClass,
    resolveSymbol,
    setObjectProperty,
    setValuePointer,
    setWrapper,
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
    CompiledDescriptor,
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
    RecordConverterOptions,
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
     * `getType`, `getWrapper`, `setWrapper`). Its bytes are not accessible from JavaScript.
     */
    export type Handle = { _opaque: "Handle" };
    /** A validated native value codec reusable across fields, pointer values, and function signatures. */
    export type CompiledDescriptor = { _opaque: "CompiledDescriptor" };
    /** A compiled ABI signature and marshalling plan shared by calls and callback trampolines. */
    export type FunctionSignature = { _opaque: "FunctionSignature" };
    /** A reference to a shared library that remains loaded for the life of the process. */
    export type LibraryHandle = { _opaque: "LibraryHandle" };
    export type Ref = { value: unknown };
    export type CallbackFailure = { nativeError: ExternalObject<Handle>; thrown: unknown };
}
