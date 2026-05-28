/**
 * Proxy module that the vitest plugin substitutes in place of `@gtkx/native`.
 *
 * Re-exports every public symbol with a wrapper that records the *shape* of
 * the operation into the process-global {@link recorder} before delegating
 * to the real native binding. Imports of `@gtkx/native` from inside this
 * package are left unaliased by the plugin, so the `nativeReal` namespace
 * below points at the genuine module.
 *
 * The wrapper deliberately ignores all dynamic values (argument values,
 * handles, GType numbers, results) — those are run-volatile and would
 * defeat a deterministic golden manifest.
 */

import * as nativeReal from "@gtkx/native";
import type { Arg, FfiValue, NativeHandle, RegisterClassNativeOptions, Type } from "@gtkx/native";

import { recorder } from "./recorder.js";

export type { Arg, CallbackType, FfiValue, NativeHandle, Ref, Type } from "@gtkx/native";
export type { RegisterClassInterfaceVfuncsDefinition, RegisterClassNativeOptions, RegisterClassVfuncDefinition } from "@gtkx/native";

export const getNativeId: typeof nativeReal.getNativeId = nativeReal.getNativeId;
export const createRef: typeof nativeReal.createRef = nativeReal.createRef;

/** Dispatches a low-level FFI call and records its shape. */
export function call(library: string, symbol: string, args: Arg[], returnType: Type): FfiValue {
    recorder.recordCall(library, symbol, args, returnType);
    return nativeReal.call(library, symbol, args, returnType);
}

/** Allocates memory for a boxed type or plain struct and records the shape. */
export function alloc(size: number, glibTypeName?: string, lib?: string): NativeHandle {
    recorder.recordAlloc(size, glibTypeName, lib);
    return nativeReal.alloc(size, glibTypeName, lib);
}

/** Reads a value from native memory and records the shape. */
export function read(handle: NativeHandle, type: Type, offset: number): FfiValue {
    recorder.recordRead(type, offset);
    return nativeReal.read(handle, type, offset);
}

/** Writes a value to native memory and records the shape. */
export function write(handle: NativeHandle, type: Type, offset: number, value: unknown): void {
    recorder.recordWrite(type, offset);
    nativeReal.write(handle, type, offset, value);
}

/** Looks up a property descriptor on a GObject by name and records the shape. */
export function findObjectProperty(handle: NativeHandle, propertyName: string): NativeHandle | null {
    recorder.recordFindObjectProperty(propertyName);
    return nativeReal.findObjectProperty(handle, propertyName);
}

/** Returns the runtime GType of a GTypeInstance-compatible handle. */
export const getInstanceGType: typeof nativeReal.getInstanceGType = nativeReal.getInstanceGType;

/** Registers a new GType derived from `parentGtype` and records the class shape. */
export function registerClass(name: string, parentGtype: number, options?: RegisterClassNativeOptions): number {
    recorder.recordRegisterClass(name, options?.vfuncs ?? [], options?.interfaceVfuncs ?? []);
    return nativeReal.registerClass(name, parentGtype, options);
}

/** Suspends GTK frame-clock dispatch. Recording omitted: shape is constant. */
export const freeze: typeof nativeReal.freeze = nativeReal.freeze;

/** Resumes GTK frame-clock dispatch. Recording omitted: shape is constant. */
export const unfreeze: typeof nativeReal.unfreeze = nativeReal.unfreeze;

/** Quits the GLib main loop. Recording omitted: shape is constant. */
export const stop: typeof nativeReal.stop = nativeReal.stop;
