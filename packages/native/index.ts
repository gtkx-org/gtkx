import * as native from "./native-binding.cjs";
import type { Arg, CompiledSignature, Handle, RegisterClassOptions, Type, Value } from "./types.js";

export * from "./types.js";

export function call(library: string, symbol: string, args: Arg[], returnType: Type): Value {
    return native.call(library, symbol, args, returnType) as Value;
}

export function compileSignature(argTypes: Type[], returnType: Type): CompiledSignature {
    return native.compileSignature(argTypes, returnType) as CompiledSignature;
}

export function callCompiled(library: string, symbol: string, compiled: CompiledSignature, values: Value[]): Value {
    return native.callCompiled(library, symbol, compiled, values) as Value;
}

let mainLoopHandle: Handle | null = native.init();

export function quit(): void {
    if (!mainLoopHandle) return;
    native.quit(mainLoopHandle);
    mainLoopHandle = null;
}

export function read(handle: Handle, type: Type, offset: number): Value {
    return native.read(handle, type, offset) as Value;
}

export function write(handle: Handle, type: Type, offset: number, value: unknown): void {
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
