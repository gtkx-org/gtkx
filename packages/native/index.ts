import * as native from "./native-binding.cjs";
import type { Arg, Handle, RegisterClassOptions, Type, Value } from "./types.js";

export * from "./types.js";

/**
 * Makes a low-level FFI call to a native library.
 *
 * This is the core FFI mechanism. Most code should use the generated
 * bindings in `@gtkx/ffi` instead of calling this directly.
 *
 * @param library - Shared library name (e.g., "libgtk-4.so.1")
 * @param symbol - Function symbol name
 * @param args - Function arguments with type information
 * @param returnType - Expected return type
 * @returns The function return value
 */
export function call(library: string, symbol: string, args: Arg[], returnType: Type): Value {
    return native.call(library, symbol, args, returnType) as Value;
}

/**
 * Handle to the `GLib` main loop spawned automatically when this module is
 * first loaded. Stored so {@link quit} can quit the loop without callers
 * having to thread the handle through.
 */
let mainLoopHandle: Handle | null = native.init();

/**
 * Quits the `GLib` main loop spawned at module load.
 *
 * Drains all pending finalizers before quitting so the spawned GLib thread
 * terminates cleanly. Subsequent calls are no-ops. Most code should rely on
 * `@gtkx/ffi`'s lifecycle wrapper instead of calling this directly.
 */
export function quit(): void {
    if (!mainLoopHandle) return;
    native.quit(mainLoopHandle);
    mainLoopHandle = null;
}

/**
 * Reads a value from native memory.
 *
 * @param handle - Native handle pointing to the memory
 * @param type - Type of value to read
 * @param offset - Byte offset from the handle pointer
 * @returns The read value
 */
export function read(handle: Handle, type: Type, offset: number): Value {
    return native.read(handle, type, offset) as Value;
}

/**
 * Writes a value to native memory.
 *
 * @param handle - Native handle pointing to the memory
 * @param type - Type of value to write
 * @param offset - Byte offset from the handle pointer
 * @param value - Value to write
 */
export function write(handle: Handle, type: Type, offset: number, value: unknown): void {
    native.write(handle, type, offset, value);
}

/**
 * Allocates memory for a boxed type or plain struct.
 *
 * @param size - Size in bytes to allocate
 * @param glibTypeName - GLib type name for boxed types (optional for plain structs)
 * @returns Native handle to allocated memory
 */
export function alloc(size: number, glibTypeName?: string): Handle {
    return native.alloc(size, glibTypeName) as Handle;
}

/**
 * Returns the runtime GType of a `GTypeInstance`-compatible handle.
 *
 * Reads the `g_class->g_type` field on the GLib thread. Returns `0`
 * (`G_TYPE_INVALID`) when the handle is null or the class pointer is unset.
 *
 * @param handle - Handle to a live GObject-compatible instance
 */
export function getType(handle: Handle): number {
    return native.getType(handle) as number;
}

/**
 * Registers a new `GType` derived from `parentGtype` under `name`.
 *
 * Wraps `g_type_register_static`, sizing the new class so it matches the
 * parent's class and instance struct sizes. Class vfunc overrides are installed
 * inside `class_init`; inherited-interface vfunc overrides are written into the
 * new class's interface vtables once the class is initialized. Higher-level
 * orchestration (resolving the parent class, walking JS prototypes, updating
 * the JS class registry) lives in `@gtkx/ffi`'s `registerClass`.
 *
 * @param name - Globally-unique GType name (must not already be registered)
 * @param parentGtype - Numeric GType of the parent class
 * @param options - Optional class and inherited-interface vfunc overrides
 * @returns Numeric GType of the newly registered subclass
 */
export function registerClass(name: string, parentGtype: number, options?: RegisterClassOptions): number {
    return native.registerClass(name, parentGtype, options) as number;
}

/**
 * Binds a freshly created JavaScript wrapper to the `GObject` behind `handle`
 * by installing a toggle reference, making the wrapper and object share one
 * lifetime. Called once per object, the first time it is wrapped.
 *
 * @param handle - A handle produced by this module
 * @param wrapper - The JavaScript wrapper object to bind
 */
export function setWrapper(handle: Handle, wrapper: object): void {
    native.setWrapper(handle, wrapper);
}

/**
 * Returns the existing JavaScript wrapper bound to the `GObject` behind
 * `handle`, or `null` when the object is untracked or its wrapper has already
 * been garbage collected.
 *
 * @param handle - A handle produced by this module
 */
export function getWrapper(handle: Handle): object | null {
    return native.getWrapper(handle) ?? null;
}

/**
 * Suspends GTK frame-clock dispatch while a batch of mutations is applied.
 *
 * Bracketed by {@link unfreeze} to release the GLib main loop. Calls nest: only
 * the outermost `freeze` / `unfreeze` pair starts and stops the freeze loop.
 */
export function freeze(): void {
    native.freeze();
}

/**
 * Resumes normal GTK frame-clock dispatch after a {@link freeze} block.
 */
export function unfreeze(): void {
    native.unfreeze();
}
