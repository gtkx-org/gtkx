import {
    type Arg,
    type NativeHandle,
    alloc as nativeAlloc,
    call as nativeCall,
    poll as nativePoll,
    read as nativeRead,
    readPointer as nativeReadPointer,
    start as nativeStart,
    stop as nativeStop,
    write as nativeWrite,
    writePointer as nativeWritePointer,
    type Type,
} from "@gtkx/native";
import { init as initAdwaita } from "../generated/adw/functions.js";
import type { ApplicationFlags } from "../generated/gio/enums.js";
import type { Application } from "../generated/gtk/application.js";
import { finalize as finalizeGtkSource, init as initGtkSource } from "../generated/gtksource/functions.js";
import { events } from "./events.js";
import { getNativeObject } from "./object.js";

declare const Deno: unknown;
const isDeno = typeof Deno !== "undefined";

let keepAliveTimeout: ReturnType<typeof setTimeout> | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let application: Application | null = null;
let isStopping = false;

/**
 * Whether the GTK application runtime is currently running.
 * `true` if {@link start} has been called and {@link stop} has not.
 */
export let isStarted = false;

/**
 * Returns why FFI calls are not allowed, or null if they are allowed.
 *
 * @returns Error reason string, or null if runtime is available
 */
export const getStartError = (): string | null => {
    if (!isStarted) {
        return "GTK runtime not started. Call start() before making FFI calls.";
    }
    return null;
};

/**
 * Invokes a native function through FFI.
 *
 * @param library - Library name (e.g., "gtk", "adw")
 * @param symbol - Function symbol name
 * @param args - Arguments with type information for marshaling
 * @param returnType - Expected return type descriptor
 * @returns The unmarshaled return value
 * @throws If runtime not started or undefined required argument
 */
export const call = (library: string, symbol: string, args: Arg[], returnType: Type): unknown => {
    const startError = getStartError();
    if (startError) {
        throw new Error(`[gtkx] ${startError} (attempted call: ${library}:${symbol})`);
    }

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg?.value === undefined && !arg?.optional) {
            const err = new Error(`[gtkx] Undefined value in FFI call: ${library}:${symbol} arg[${i}]`);
            console.error(err.message, { arg, args });
            console.error(err.stack);
            throw err;
        }
    }

    return nativeCall(library, symbol, args, returnType);
};

/**
 * Allocates native memory for a structure or buffer.
 *
 * @param size - Number of bytes to allocate
 * @param typeName - Optional type name for debugging
 * @param library - Optional library name for debugging
 * @returns Handle to the allocated memory
 * @throws If runtime not started
 */
export const alloc = (size: number, typeName?: string, library?: string): unknown => {
    const startError = getStartError();
    if (startError) {
        throw new Error(`[gtkx] ${startError} (attempted alloc: ${library ?? "unknown"}:${typeName ?? "unknown"})`);
    }
    return nativeAlloc(size, typeName, library);
};

/**
 * Reads a value from native memory.
 *
 * @param handle - Handle to the memory region
 * @param type - Type descriptor for unmarshaling
 * @param offset - Byte offset within the memory region
 * @returns The unmarshaled value
 * @throws If runtime not started
 */
export const read = (handle: unknown, type: Type, offset: number): unknown => {
    const startError = getStartError();
    if (startError) {
        throw new Error(`[gtkx] ${startError} (attempted read)`);
    }
    return nativeRead(handle, type, offset);
};

/**
 * Reads a value through a pointer in native memory.
 *
 * @param handle - Handle to the memory region containing the pointer
 * @param ptrOffset - Byte offset to the pointer within handle
 * @param elementOffset - Byte offset from the dereferenced pointer
 * @returns Handle to the dereferenced memory location
 * @throws If runtime not started
 */
export const readPointer = (handle: unknown, ptrOffset: number, elementOffset: number): unknown => {
    const startError = getStartError();
    if (startError) {
        throw new Error(`[gtkx] ${startError} (attempted readPointer)`);
    }
    return nativeReadPointer(handle, ptrOffset, elementOffset);
};

/**
 * Writes a value to native memory.
 *
 * @param handle - Handle to the memory region
 * @param type - Type descriptor for marshaling
 * @param offset - Byte offset within the memory region
 * @param value - Value to write
 * @throws If runtime not started
 */
export const write = (handle: unknown, type: Type, offset: number, value: unknown): void => {
    const startError = getStartError();
    if (startError) {
        throw new Error(`[gtkx] ${startError} (attempted write)`);
    }
    nativeWrite(handle, type, offset, value);
};

/**
 * Writes data through a pointer in native memory.
 *
 * @param destHandle - Handle to the destination memory region
 * @param ptrOffset - Byte offset to the pointer within destHandle
 * @param elementOffset - Byte offset from the dereferenced pointer
 * @param sourceHandle - Handle to the source data
 * @param size - Number of bytes to copy
 * @throws If runtime not started
 */
export const writePointer = (
    destHandle: unknown,
    ptrOffset: number,
    elementOffset: number,
    sourceHandle: unknown,
    size: number,
): void => {
    const startError = getStartError();
    if (startError) {
        throw new Error(`[gtkx] ${startError} (attempted writePointer)`);
    }
    nativeWritePointer(destHandle, ptrOffset, elementOffset, sourceHandle, size);
};

const keepAlive = (): void => {
    keepAliveTimeout = setTimeout(() => keepAlive(), 2147483647);
};

const startPolling = (): void => {
    if (pollInterval) return;
    pollInterval = setInterval(() => nativePoll(), 0);
};

const stopPolling = (): void => {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
};

/**
 * Initializes the GTK application runtime.
 *
 * Creates a GTK Application instance, initializes Adwaita and GtkSource
 * if available, and starts the event loop.
 *
 * @param appId - Application ID in reverse domain notation (e.g., "com.example.app")
 * @param flags - Optional GIO application flags
 * @returns The GTK Application instance
 *
 * @example
 * ```tsx
 * import { start } from "@gtkx/ffi";
 *
 * const app = start("com.example.myapp");
 * ```
 *
 * @see {@link stop} for shutting down the application
 */
export const start = (appId: string, flags?: ApplicationFlags): Application => {
    if (application) {
        return application;
    }

    const app = nativeStart(appId, flags);
    isStarted = true;
    application = getNativeObject(app as NativeHandle) as Application;

    try {
        initAdwaita();
        initGtkSource();
    } catch {}

    keepAlive();

    if (isDeno) {
        startPolling();
    }

    events.emit("start");
    return application;
};

/**
 * Shuts down the GTK application runtime.
 *
 * Stops the event loop, cleans up resources, and finalizes libraries.
 * Emits a "stop" event before cleanup.
 *
 * @see {@link start} for initializing the application
 * @see {@link events} for lifecycle event handling
 */
export const stop = (): void => {
    if (!application || isStopping) {
        return;
    }

    isStopping = true;

    if (keepAliveTimeout) {
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
    }

    stopPolling();
    events.emit("stop");

    try {
        finalizeGtkSource();
    } catch {}

    application = null;
    isStarted = false;
    nativeStop();
    isStopping = false;
};
