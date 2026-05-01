import type { NativeHandle } from "@gtkx/native";
import { Object as GObject } from "../generated/gobject/object.js";
import type { Value } from "../generated/gobject/value.js";
import { call } from "../native.js";
import { getNativeObject } from "../registry.js";

declare module "../generated/gobject/object.js" {
    namespace Object {
        /**
         * Creates a new instance of a GObject subtype and sets its properties
         * using the provided arrays. Both arrays must have exactly the same
         * number of elements, and the names and values correspond by index.
         *
         * Construction parameters (see G_PARAM_CONSTRUCT, G_PARAM_CONSTRUCT_ONLY)
         * which are not explicitly specified are set to their default values.
         *
         * @param objectType - The GType of the object to instantiate
         * @param names - The names of each property to be set
         * @param values - The values of each property to be set
         * @returns A new instance of the specified type
         */
        function newWithProperties(objectType: number, names: string[], values: Value[]): Object;
    }

    interface Object {
        /**
         * Disconnects a signal handler previously connected via
         * {@link Object.connect}, {@link Object.on}, or {@link Object.once}.
         *
         * @param handlerId - The handler ID returned by `connect`/`on`/`once`
         */
        disconnect(handlerId: number): void;

        /**
         * Connects a callback to a signal.
         *
         * Equivalent to {@link Object.connect}, but tracks the callback so it
         * can be later removed via {@link Object.off} without needing the
         * handler ID.
         *
         * @param signal - The signal name
         * @param handler - The callback function
         * @param after - If true, run after the default handler
         * @returns This object, for chaining
         */
        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        on(signal: string, handler: (...args: any[]) => any, after?: boolean): this;

        /**
         * Like {@link Object.on}, but the handler is automatically disconnected
         * after the first emission.
         */
        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        once(signal: string, handler: (...args: any[]) => any, after?: boolean): this;

        /**
         * Disconnects a callback previously registered with
         * {@link Object.on} or {@link Object.once}.
         *
         * @param signal - The signal name
         * @param handler - The exact callback reference passed to `on`/`once`
         * @returns This object, for chaining
         */
        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        off(signal: string, handler: (...args: any[]) => any): this;
    }
}

const LIB = "libgobject-2.0.so.0";
const GVALUE_SIZE = 24;

type ObjectStatic = {
    newWithProperties(objectType: number, names: string[], values: Value[]): GObject;
};

const ObjectWithStatics = GObject as typeof GObject & ObjectStatic;

ObjectWithStatics.newWithProperties = (objectType: number, names: string[], values: Value[]): GObject => {
    const ptr = call(
        LIB,
        "g_object_new_with_properties",
        [
            {
                type: { type: "uint64" },
                value: objectType,
            },
            {
                type: { type: "uint32" },
                value: names.length,
            },
            {
                type: {
                    type: "array",
                    itemType: { type: "string", ownership: "borrowed" },
                    kind: "sized",
                    sizeParamIndex: 1,
                    ownership: "borrowed",
                },
                value: names,
            },
            {
                type: {
                    type: "array",
                    itemType: {
                        type: "boxed",
                        ownership: "borrowed",
                        innerType: "GValue",
                        library: LIB,
                        getTypeFn: "g_value_get_type",
                    },
                    kind: "sized",
                    sizeParamIndex: 1,
                    elementSize: GVALUE_SIZE,
                    ownership: "borrowed",
                },
                value: values.map((v) => v.handle),
            },
        ],
        { type: "gobject", ownership: "borrowed" },
    );
    return getNativeObject(ptr as NativeHandle) as GObject;
};

type Listener = (...args: unknown[]) => unknown;
const listenerTable = new WeakMap<GObject, Map<string, Map<Listener, number>>>();

const trackListener = (instance: GObject, signal: string, handler: Listener, handlerId: number): void => {
    let bySignal = listenerTable.get(instance);
    if (!bySignal) {
        bySignal = new Map();
        listenerTable.set(instance, bySignal);
    }
    let byHandler = bySignal.get(signal);
    if (!byHandler) {
        byHandler = new Map();
        bySignal.set(signal, byHandler);
    }
    byHandler.set(handler, handlerId);
};

const findHandlerId = (instance: GObject, signal: string, handler: Listener): number | undefined => {
    return listenerTable.get(instance)?.get(signal)?.get(handler);
};

const untrackListener = (instance: GObject, signal: string, handler: Listener): void => {
    const bySignal = listenerTable.get(instance);
    const byHandler = bySignal?.get(signal);
    byHandler?.delete(handler);
    if (byHandler && byHandler.size === 0) bySignal?.delete(signal);
};

GObject.prototype.disconnect = function disconnect(handlerId: number): void {
    call(
        LIB,
        "g_signal_handler_disconnect",
        [
            { type: { type: "gobject", ownership: "borrowed" }, value: this.handle },
            { type: { type: "uint64" }, value: handlerId },
        ],
        { type: "void" },
    );
};

GObject.prototype.on = function on<T extends GObject>(this: T, signal: string, handler: Listener, after?: boolean): T {
    const handlerId = (this as GObject).connect(signal, handler, after);
    trackListener(this, signal, handler, handlerId);
    return this;
};

GObject.prototype.once = function once<T extends GObject>(
    this: T,
    signal: string,
    handler: Listener,
    after?: boolean,
): T {
    const wrapped: Listener = (...args: unknown[]) => {
        (this as GObject).off(signal, wrapped);
        return handler(...args);
    };
    const handlerId = (this as GObject).connect(signal, wrapped, after);
    trackListener(this, signal, wrapped, handlerId);
    trackListener(this, signal, handler, handlerId);
    return this;
};

GObject.prototype.off = function off<T extends GObject>(this: T, signal: string, handler: Listener): T {
    const handlerId = findHandlerId(this, signal, handler);
    if (handlerId !== undefined) {
        (this as GObject).disconnect(handlerId);
        untrackListener(this, signal, handler);
    }
    return this;
};
