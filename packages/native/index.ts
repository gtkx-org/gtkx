import * as native from "./native-binding.cjs";
import type { Arg, ArrayType, FfiValue, HashTableType, RefType, TrampolineType, Type } from "./types.js";

type NativeVfuncDefinition = {
    readonly byteOffset: number;
    readonly argTypes: readonly Type[];
    readonly returnType: Type;
    readonly fn: (...args: unknown[]) => unknown;
};

type NativeInterfaceVfuncsDefinition = {
    readonly gtype: number;
    readonly vfuncs: readonly NativeVfuncDefinition[];
};

type NativeRegisterClassOptions = {
    readonly vfuncs?: readonly NativeVfuncDefinition[];
    readonly interfaceVfuncs?: readonly NativeInterfaceVfuncsDefinition[];
};

type ExternalHandle = Parameters<typeof native.read>[0];

declare const __nativeHandleBrand: unique symbol;

/**
 * Opaque reference to a native pointer (GObject, Boxed, Fundamental, or
 * GLib main-loop handle).
 *
 * Values of this type are produced exclusively by the functions in this
 * module ({@link alloc}, {@link call}, etc.) and must never be constructed
 * by user code. The underlying value is a raw
 * native external pointer; the brand ensures TypeScript treats it opaquely.
 */
export type NativeHandle = { readonly [__nativeHandleBrand]: never };

function isHandleType(type: Type): boolean {
    return type.type === "gobject" || type.type === "boxed" || type.type === "struct" || type.type === "fundamental";
}

function unwrapValue(value: unknown, type: Type): unknown {
    if (value === null || value === undefined) return value;

    if (isHandleType(type)) return value;

    switch (type.type) {
        case "array":
            return unwrapArray(value, type);
        case "hashtable":
            return unwrapHashTable(value, type);
        case "ref":
            return unwrapRefArg(value as { value: unknown }, type);
        case "trampoline":
            return wrapUserCallback(value, type);
        default:
            return value;
    }
}

function unwrapArray(value: unknown, type: ArrayType): unknown {
    if (!Array.isArray(value)) return value;
    return value.map((item) => unwrapValue(item, type.itemType));
}

function unwrapHashTable(value: unknown, type: HashTableType): unknown {
    if (!Array.isArray(value)) return value;
    return value.map((entry) => {
        if (!Array.isArray(entry) || entry.length !== 2) return entry;
        return [unwrapValue(entry[0], type.keyType), unwrapValue(entry[1], type.valueType)];
    });
}

function unwrapRefArg(ref: { value: unknown }, type: RefType): { value: unknown } {
    ref.value = unwrapValue(ref.value, type.innerType);
    return ref;
}

function wrapUserCallback(value: unknown, type: TrampolineType): unknown {
    if (typeof value !== "function") return value;
    const userCb = value as (...args: unknown[]) => unknown;
    const { argTypes, returnType } = type;
    return (...args: unknown[]) => {
        const wrappedArgs = args.map((arg, i) => wrapValue(arg, argTypes[i] ?? { type: "void" }));
        const result = userCb(...wrappedArgs);
        return unwrapValue(result, returnType);
    };
}

function wrapValue(value: unknown, type: Type): unknown {
    if (value === null || value === undefined) return value;

    if (isHandleType(type)) return value;

    switch (type.type) {
        case "array":
            return Array.isArray(value) ? value.map((item) => wrapValue(item, type.itemType)) : value;
        case "hashtable":
            if (!Array.isArray(value)) return value;
            return value.map((entry) => {
                if (!Array.isArray(entry) || entry.length !== 2) return entry;
                return [wrapValue(entry[0], type.keyType), wrapValue(entry[1], type.valueType)];
            });
        default:
            return value;
    }
}

function rewrapRefArg(ref: { value: unknown }, type: RefType): void {
    ref.value = wrapValue(ref.value, type.innerType);
}

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
export function call(library: string, symbol: string, args: Arg[], returnType: Type): FfiValue {
    const unwrapped = args.map((arg) => ({
        ...arg,
        value: unwrapValue(arg.value, arg.type),
    }));

    const result = native.call(library, symbol, unwrapped, returnType);

    for (const arg of args) {
        if (arg.type.type === "ref") {
            rewrapRefArg(arg.value as { value: unknown }, arg.type);
        }
    }

    return wrapValue(result, returnType) as FfiValue;
}

/**
 * Handle to the `GLib` main loop spawned automatically when this module is
 * first loaded. Stored so {@link stop} can quit the loop without callers
 * having to thread the handle through.
 */
let mainLoopHandle: NativeHandle | null = native.init() as unknown as NativeHandle;

/**
 * Quits the `GLib` main loop spawned at module load.
 *
 * Drains all pending finalizers before quitting so the spawned GLib thread
 * terminates cleanly. Subsequent calls are no-ops. Most code should rely on
 * `@gtkx/ffi`'s lifecycle wrapper instead of calling this directly.
 */
export function stop(): void {
    if (!mainLoopHandle) return;
    native.stop(mainLoopHandle as unknown as Parameters<typeof native.stop>[0]);
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
export function read(handle: NativeHandle, type: Type, offset: number): FfiValue {
    const result = native.read(handle as unknown as ExternalHandle, type, offset);
    return wrapValue(result, type) as FfiValue;
}

/**
 * Writes a value to native memory.
 *
 * @param handle - Native handle pointing to the memory
 * @param type - Type of value to write
 * @param offset - Byte offset from the handle pointer
 * @param value - Value to write
 */
export function write(handle: NativeHandle, type: Type, offset: number, value: unknown): void {
    native.write(handle as unknown as ExternalHandle, type, offset, unwrapValue(value, type));
}

/**
 * Allocates memory for a boxed type or plain struct.
 *
 * @param size - Size in bytes to allocate
 * @param glibTypeName - GLib type name for boxed types (optional for plain structs)
 * @param lib - Optional library containing the type
 * @returns Native handle to allocated memory
 */
export function alloc(size: number, glibTypeName?: string, lib?: string): NativeHandle {
    return native.alloc(size, glibTypeName, lib) as unknown as NativeHandle;
}

/**
 * Looks up a property descriptor on a `GObject` instance by property name.
 *
 * Walks the `GTypeInstance` → `GObjectClass` → `g_object_class_find_property`
 * chain entirely on the GLib thread, returning a borrowed `GParamSpec` handle
 * (or `null` if the property is unknown). The returned handle's pointer is
 * owned by the class vtable and remains valid for the lifetime of the type
 * registration.
 *
 * @param handle - Handle to a live `GObject` instance
 * @param propertyName - Property name in dashed form (e.g. `"label"`, `"halign"`)
 * @returns Borrowed `GParamSpec` handle, or `null` when no such property exists
 */
export function findObjectProperty(handle: NativeHandle, propertyName: string): NativeHandle | null {
    const result = native.findObjectProperty(handle as unknown as ExternalHandle, propertyName);
    return result == null ? null : (result as NativeHandle);
}

/**
 * Returns the runtime GType of a `GTypeInstance`-compatible handle.
 *
 * Reads the `g_class->g_type` field on the GLib thread. Returns `0`
 * (`G_TYPE_INVALID`) when the handle is null or the class pointer is unset.
 *
 * @param handle - Handle to a live GObject-compatible instance
 */
export function getInstanceGType(handle: NativeHandle): number {
    return native.getInstanceGtype(handle as unknown as ExternalHandle) as number;
}

/**
 * Virtual function override installed into a registered class's vtable.
 *
 * `byteOffset` is the offset (in bytes) of the function pointer slot inside
 * the class struct relative to the class struct base; the JavaScript function
 * is wrapped in a libffi trampoline whose generated C function pointer is
 * written at that offset during class initialization.
 */
export type RegisterClassVfuncDefinition = {
    /** Byte offset of the vfunc slot within the class struct. */
    readonly byteOffset: number;
    /** FFI argument types matching the vfunc signature. */
    readonly argTypes: readonly Type[];
    /** FFI return type matching the vfunc signature. */
    readonly returnType: Type;
    /** Implementation invoked on each vfunc call. */
    readonly fn: (...args: unknown[]) => unknown;
};

/**
 * Vfunc overrides targeting one interface that the registered class inherits
 * from its parent.
 *
 * `gtype` is the GType of the inherited interface. `vfuncs` are the overrides,
 * with `byteOffset` relative to the interface struct base (not the class
 * struct). Each vfunc is wrapped in a libffi trampoline whose function pointer
 * is written into the new class's own copy of the inherited interface vtable.
 */
type RegisterClassInterfaceVfuncsDefinition = {
    /** GType of the inherited interface whose vfuncs are overridden. */
    readonly gtype: number;
    /** Vfunc overrides relative to the interface struct base. */
    readonly vfuncs: readonly RegisterClassVfuncDefinition[];
};

/**
 * Optional payload for {@link registerClass} carrying class vfunc overrides and
 * inherited-interface vfunc overrides.
 */
export type RegisterClassVfuncOptions = {
    readonly vfuncs?: readonly RegisterClassVfuncDefinition[];
    readonly interfaceVfuncs?: readonly RegisterClassInterfaceVfuncsDefinition[];
};

/**
 * Registers a new `GType` derived from `parentGType` under `name`.
 *
 * Wraps `g_type_register_static`, sizing the new class so it matches the
 * parent's class and instance struct sizes. Class vfunc overrides are installed
 * inside `class_init`; inherited-interface vfunc overrides are written into the
 * new class's interface vtables once the class is initialized. Higher-level
 * orchestration (resolving the parent class, walking JS prototypes, updating
 * the JS class registry) lives in `@gtkx/ffi`'s `registerClass`.
 *
 * @param name - Globally-unique GType name (must not already be registered)
 * @param parentGType - Numeric GType of the parent class
 * @param options - Optional class and inherited-interface vfunc overrides
 * @returns Numeric GType of the newly registered subclass
 */
export function registerClass(name: string, parentGType: number, options?: RegisterClassVfuncOptions): number {
    const nativeOptions = options ? buildNativeOptions(options) : undefined;
    return native.registerClass(name, parentGType, nativeOptions) as number;
}

function buildNativeOptions(options: RegisterClassVfuncOptions): NativeRegisterClassOptions {
    return {
        vfuncs: options.vfuncs?.map(toNativeVfunc),
        interfaceVfuncs: options.interfaceVfuncs?.map((iface) => ({
            gtype: iface.gtype,
            vfuncs: iface.vfuncs.map(toNativeVfunc),
        })),
    };
}

function toNativeVfunc(vfunc: RegisterClassVfuncDefinition): NativeVfuncDefinition {
    return {
        byteOffset: vfunc.byteOffset,
        argTypes: [...vfunc.argTypes],
        returnType: vfunc.returnType,
        fn: vfunc.fn,
    };
}

/**
 * Installs the JavaScript callback that applies a wrapper-reference operation,
 * invoked synchronously on the JS thread with `(refPtr, opcode)` whenever a
 * `GObject`'s toggle reference must flip its wrapper strong/weak or delete it.
 *
 * Installed once at startup by `@gtkx/ffi`. The `refPtr` is forwarded verbatim
 * to {@link applyWrapperRefOp}; the opcode meanings are an internal native
 * detail callers never interpret.
 *
 * @param callback - Receives `(refPtr, opcode)` for each reference operation
 */
export function setObjectToggleNotify(callback: (refPtr: number, op: number) => void): void {
    native.setObjectToggleNotify(callback);
}

/**
 * Applies one wrapper-reference operation requested by the toggle-notify
 * callback. Runs on the JS thread, where every napi reference call must happen.
 *
 * @param refPtr - The wrapper reference pointer, as delivered to the toggle callback
 * @param op - The opcode delivered alongside `refPtr`
 */
export function applyWrapperRefOp(refPtr: number, op: number): void {
    native.applyWrapperRefOp(refPtr, op);
}

/**
 * Binds a freshly created JavaScript wrapper to the `GObject` behind `handle`
 * by installing a toggle reference, making the wrapper and object share one
 * lifetime. Called once per object, the first time it is wrapped.
 *
 * @param handle - A handle produced by this module
 * @param wrapper - The JavaScript wrapper object to bind
 */
export function setWrapper(handle: NativeHandle, wrapper: object): void {
    native.setWrapper(handle as unknown as ExternalHandle, wrapper);
}

/**
 * Returns the existing JavaScript wrapper bound to the `GObject` behind
 * `handle`, or `null` when the object is untracked or its wrapper has already
 * been garbage collected.
 *
 * @param handle - A handle produced by this module
 */
export function getWrapper(handle: NativeHandle): object | null {
    return (native.getWrapper(handle as unknown as ExternalHandle) as object | undefined) ?? null;
}

/**
 * Suspends GTK frame-clock dispatch while a batch of mutations is applied.
 *
 * Bracketed by [[unfreeze]] to release the GLib main loop. Calls nest: only
 * the outermost `freeze` / `unfreeze` pair starts and stops the freeze loop.
 *
 * @internal Wrapped by `@gtkx/ffi`'s commit-bracket facade.
 */
export function freeze(): void {
    native.freeze();
}

/**
 * Resumes normal GTK frame-clock dispatch after a [[freeze]] block.
 *
 * @internal Wrapped by `@gtkx/ffi`'s commit-bracket facade.
 */
export function unfreeze(): void {
    native.unfreeze();
}

export type { Arg, FfiValue, Type } from "./types.js";
