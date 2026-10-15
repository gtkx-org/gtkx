import {
    type CallLayout,
    type CallResult,
    type FunctionSignature,
    call as nativeCall,
    bindFunction,
    type Descriptor,
    type ExternalObject,
    type Handle,
    type LibraryHandle,
    openLibrary,
    getTypeClass,
    readField,
    type DecodedCallback,
    resolveSymbol,
} from "@gtkx/native";

type BoundCall = {
    signature: ExternalObject<FunctionSignature>;
    resolve: () => ExternalObject<Handle>;
};
type BindVfuncOptions = {
    instanceType?: bigint;
    interfaceType?: bigint;
    byteOffset: number;
    vtableSize?: number;
    label: string;
    argDescriptors: Descriptor[];
    returnDescriptor: Descriptor;
    layout: CallLayout;
};

const libraries: Map<string, ExternalObject<LibraryHandle>> = new Map();

const libraryFor = (candidates: string): ExternalObject<LibraryHandle> => {
    const cached = libraries.get(candidates);
    if (cached !== undefined) {
        return cached;
    }
    let failure: unknown;
    for (const candidate of candidates.split(",")) {
        if (candidate.includes("\0")) {
            throw new TypeError("Failed to load library: library names must not contain NUL bytes");
        }
        try {
            const library = openLibrary(candidate);
            libraries.set(candidates, library);
            return library;
        } catch (error) {
            failure = error;
        }
    }
    const reason = failure instanceof Error ? failure.message : String(failure);
    throw new Error(`Failed to load library '${candidates}': ${reason}`, { cause: failure });
};

const resolveFunctionOptional = (sharedLibrary: string, symbol: string): ExternalObject<Handle> | null =>
    resolveSymbol(libraryFor(sharedLibrary), symbol, true) ?? null;

const resolveFunction = (sharedLibrary: string, symbol: string): ExternalObject<Handle> => {
    const handle = resolveSymbol(libraryFor(sharedLibrary), symbol, false);
    if (handle == null) {
        throw new Error(`Failed to find symbol '${symbol}'`);
    }
    return handle;
};

const lazyCall = (signature: ExternalObject<FunctionSignature>, target: () => ExternalObject<Handle>): BoundCall => {
    let resolved: ExternalObject<Handle> | undefined;
    return { signature, resolve: () => (resolved ??= target()) };
};

const bind = (
    sharedLibrary: string,
    symbol: string,
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
    layout: CallLayout,
): BoundCall => {
    const signature = bindFunction(argDescriptors, returnDescriptor, symbol, layout);
    return lazyCall(signature, () => resolveFunction(sharedLibrary, symbol));
};

const bindFunctionPointer = (
    handle: ExternalObject<Handle>,
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
    label: string,
    layout: CallLayout,
): BoundCall => {
    const signature = bindFunction(argDescriptors, returnDescriptor, label, layout);
    return { signature, resolve: () => handle };
};

const bindVfunc = ({ argDescriptors, returnDescriptor, layout, ...options }: BindVfuncOptions): BoundCall => {
    if (!Number.isSafeInteger(options.byteOffset) || options.byteOffset < 0 || options.byteOffset % 8 !== 0) {
        throw new RangeError(`${options.label}: a vfunc offset must be a nonnegative aligned byte count`);
    }
    const type = options.instanceType ?? options.interfaceType;
    if (type === undefined) throw new TypeError(`${options.label}: a vfunc requires an owning type`);
    const signature = bindFunction(argDescriptors, returnDescriptor, options.label, layout);
    const descriptor: Descriptor = {
        kind: "callback",
        signature,
        scope: "call",
        hasUserData: false,
        hasDestroy: false,
        destroyKind: "destroyNotify",
        releaseWithCompletion: false,
    };
    return lazyCall(signature, () => {
        const vtable = getTypeClass(type, {
            ...(options.instanceType === undefined || options.interfaceType === undefined
                ? {}
                : { interfaceType: options.interfaceType }),
            ...(options.vtableSize === undefined ? {} : { vtableSize: options.vtableSize }),
        });
        const callback = readField(descriptor, vtable, options.byteOffset) as DecodedCallback | null;
        if (callback === null) throw new Error(`${options.label}: the owning type provides no implementation`);
        return callback.function;
    });
};

const call = (descriptor: BoundCall, values: unknown[], completionIndex?: number): CallResult =>
    nativeCall(descriptor.signature, descriptor.resolve(), values, completionIndex);

export { bind, bindFunctionPointer, bindVfunc, call, resolveFunction, resolveFunctionOptional };
export type { BoundCall, BindVfuncOptions };
