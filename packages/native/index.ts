import * as native from "./native-binding.cjs";
import type { CallDescriptor, Descriptor, Handle, RegisterClassOptions, Value } from "./types.js";

export * from "./types.js";

let mainLoopHandle: Handle | null = native.init();

export function bind(
    sharedLibrary: string,
    symbol: string,
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
): CallDescriptor {
    return native.bind(sharedLibrary, symbol, argDescriptors, returnDescriptor) as CallDescriptor;
}

export function call(descriptor: CallDescriptor, values: Value[]): Value {
    return native.call(descriptor, values) as Value;
}

export function quit(): void {
    if (!mainLoopHandle) return;
    native.quit(mainLoopHandle);
    mainLoopHandle = null;
}

export function read(handle: Handle, type: Descriptor, offset: number): Value {
    return native.read(handle, type, offset) as Value;
}

export function write(handle: Handle, type: Descriptor, offset: number, value: unknown): void {
    native.write(handle, type, offset, value);
}

export function alloc(size: number, glibTypeName?: string): Handle {
    return native.alloc(size, glibTypeName) as Handle;
}

export function getType(handle: Handle): bigint {
    return native.getType(handle) as bigint;
}

export function registerClass(name: string, parentGtype: bigint, options?: RegisterClassOptions): bigint {
    return native.registerClass(name, parentGtype, options) as bigint;
}

export function setWrapper(handle: Handle, wrapper: object): void {
    native.setWrapper(handle, wrapper);
}

export function getWrapper(handle: Handle): object | null {
    return native.getWrapper(handle) ?? null;
}

export function freeze(): void {
    native.freeze();
}

export function unfreeze(): void {
    native.unfreeze();
}
