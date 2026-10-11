import {
    attachCall,
    type CallDescriptor,
    type CallLayout,
    type CallResult,
    type CallSignature,
    call as nativeCall,
    compileCall,
    compileVfuncSlot,
    type Descriptor,
    type ExternalObject,
    type Handle,
    type LibraryHandle,
    openLibrary,
    readVfuncSlot,
    resolveSymbol,
    type VfuncSlotOptions,
} from "@gtkx/native";

type BoundCall = { resolve: () => ExternalObject<CallDescriptor> };
type BindVfuncOptions = VfuncSlotOptions & {
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

const lazyCall = (signature: ExternalObject<CallSignature>, target: () => ExternalObject<Handle>): BoundCall => {
    let attached: ExternalObject<CallDescriptor> | undefined;
    return { resolve: () => (attached ??= attachCall(signature, target())) };
};

const bind = (
    sharedLibrary: string,
    symbol: string,
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
    layout: CallLayout,
): BoundCall => {
    const signature = compileCall(argDescriptors, returnDescriptor, symbol, layout);
    return lazyCall(signature, () => resolveFunction(sharedLibrary, symbol));
};

const bindFunctionPointer = (
    handle: ExternalObject<Handle>,
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
    label: string,
    layout: CallLayout,
): BoundCall => {
    const descriptor = attachCall(compileCall(argDescriptors, returnDescriptor, label, layout), handle);
    return { resolve: () => descriptor };
};

const bindVfunc = ({ argDescriptors, returnDescriptor, layout, ...options }: BindVfuncOptions): BoundCall => {
    const slot = compileVfuncSlot(options);
    const signature = compileCall(argDescriptors, returnDescriptor, options.label, layout);
    return lazyCall(signature, () => readVfuncSlot(slot));
};

const call = (descriptor: BoundCall, values: unknown[], completionIndex?: number): CallResult =>
    nativeCall(descriptor.resolve(), values, completionIndex);

export { bind, bindFunctionPointer, bindVfunc, call, resolveFunction, resolveFunctionOptional };
export type { BoundCall, BindVfuncOptions };
