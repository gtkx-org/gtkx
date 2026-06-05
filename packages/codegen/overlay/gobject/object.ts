import {
    GVALUE_BORROWED,
    GValue,
    getHandle,
    getNativeObject,
    gtypeFromFfi,
    LIBGOBJECT,
    t,
    valueFromJS,
    valueFromObject,
    valueGetType,
    valueToJS,
} from "@gtkx/ffi";
import type { GType, ParamSpec } from "@gtkx/gi/gobject/gobject.js";
import { Object as GObject, signalEmitv, signalParseName, type Value } from "@gtkx/gi/gobject/gobject.js";
import { alloc, call, findObjectProperty, getInstanceGType, type NativeHandle, read } from "@gtkx/native";

declare module "@gtkx/gi/gobject/gobject.js" {
    interface Object {
        /**
         * Runtime GType of the underlying GObject, stamped onto every instance
         * at construction time and when a native handle is wrapped. Reflects
         * the concrete leaf type, which may be more derived than the static
         * wrapper type the instance is referenced through.
         */
        __gtype__: number;

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
         * @param sigName - The signal name
         * @param callback - The callback function
         * @param after - If true, run after the default handler
         * @returns This object, for EventEmitter-style chaining
         */
        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        on(sigName: string, callback: (...args: any[]) => any, after?: boolean): Object;

        /**
         * Like {@link Object.on}, but the handler is automatically disconnected
         * after the first emission.
         */
        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        once(sigName: string, callback: (...args: any[]) => any, after?: boolean): Object;

        /**
         * Disconnects a callback previously registered with
         * {@link Object.on} or {@link Object.once}.
         *
         * @param sigName - The signal name
         * @param callback - The exact callback reference passed to `on`/`once`
         * @returns This object, for EventEmitter-style chaining
         */
        // biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
        off(sigName: string, callback: (...args: any[]) => any): Object;

        /**
         * Reads a property by name and returns it as a plain JavaScript value.
         *
         * The property's GType is resolved at runtime via the object's class,
         * a GValue is initialized with that type, populated by
         * `g_object_get_property`, and finally unmarshalled via
         * {@link valueToJS}.
         *
         * @param propertyName - The property name (kebab-case GIR name)
         * @throws if no property with that name exists on this object's class
         */
        getProperty(propertyName: string): unknown;

        /**
         * Sets a property by name from a plain JavaScript value.
         *
         * The property's GType is resolved at runtime via the object's class,
         * `value` is marshalled via {@link valueFromJS}, and the resulting
         * GValue is dispatched to `g_object_set_property`.
         *
         * @param propertyName - The property name (kebab-case GIR name)
         * @param value - The JS value to set
         * @throws if no property with that name exists, or if the value cannot
         *   be marshalled to the property's GType
         */
        setProperty(propertyName: string, value: unknown): void;
    }
}

const GOBJECT_BORROWED = t.object("borrowed");

// biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
type Listener = (...args: any[]) => any;

/**
 * The subset of the {@link GObject} surface the EventEmitter-style impls
 * rely on: the generated `connect` primitive plus the augmented members
 * (`disconnect`, `on`, `once`, `off`) declared above. Extending `GObject`
 * keeps `this` assignable to the declared method types so the prototype
 * assignments need no cast.
 */
type GObjectWithConnect = GObject & {
    connect(sigName: string, callback: Listener, after?: boolean): number;
};

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
    if (byHandler?.size === 0) bySignal?.delete(signal);
};

GObject.prototype.disconnect = function disconnect(handlerId: number): void {
    call(
        LIBGOBJECT,
        "g_signal_handler_disconnect",
        [
            { type: GOBJECT_BORROWED, value: getHandle(this) },
            { type: t.uint64, value: handlerId },
        ],
        t.void,
    );
};

function onImpl(this: GObjectWithConnect, sigName: string, callback: Listener, after?: boolean): GObject {
    const handlerId = this.connect(sigName, callback, after);
    trackListener(this, sigName, callback, handlerId);
    return this;
}
GObject.prototype.on = onImpl;

function onceImpl(this: GObjectWithConnect, sigName: string, callback: Listener, after?: boolean): GObject {
    let handlerId = 0;
    const wrapped: Listener = (...args: unknown[]) => {
        untrackListener(this, sigName, wrapped);
        untrackListener(this, sigName, callback);
        this.disconnect(handlerId);
        return callback(...args);
    };
    handlerId = this.connect(sigName, wrapped, after);
    trackListener(this, sigName, wrapped, handlerId);
    trackListener(this, sigName, callback, handlerId);
    return this;
}
GObject.prototype.once = onceImpl;

function offImpl(this: GObjectWithConnect, sigName: string, callback: Listener): GObject {
    const handlerId = findHandlerId(this, sigName, callback);
    if (handlerId !== undefined) {
        this.disconnect(handlerId);
        untrackListener(this, sigName, callback);
    }
    return this;
}
GObject.prototype.off = offImpl;

const GTYPE_SIZE = 8;
const SIGNAL_QUERY_SIZE = 56;
const SIGNAL_QUERY_N_PARAMS_OFFSET = 40;
const SIGNAL_QUERY_PARAM_TYPES_OFFSET = 48;

function emitImpl(this: GObject, sigName: string, ...args: unknown[]): void {
    const instanceGType: GType = getInstanceGType(getHandle(this));
    const [parsed, signalId, detail] = signalParseName(sigName, instanceGType, true);
    if (!parsed || signalId === 0) {
        throw new Error(`Unknown signal '${sigName}' on ${this.constructor.name || "GObject"}`);
    }

    const query = alloc(SIGNAL_QUERY_SIZE);
    call(
        LIBGOBJECT,
        "g_signal_query",
        [
            { type: t.uint32, value: signalId },
            { type: t.boxed("GSignalQuery", "borrowed"), value: query },
        ],
        t.void,
    );

    const paramValues: GValue[] = [];
    const paramCount = read(query, t.uint32, SIGNAL_QUERY_N_PARAMS_OFFSET) as number;
    if (paramCount > 0) {
        const paramTypes = read(
            query,
            t.struct("borrowed", paramCount * GTYPE_SIZE),
            SIGNAL_QUERY_PARAM_TYPES_OFFSET,
        ) as NativeHandle;
        for (let i = 0; i < paramCount; i++) {
            const paramGType = gtypeFromFfi(read(paramTypes, t.uint64, i * GTYPE_SIZE));
            paramValues.push(valueFromJS(paramGType, args[i]));
        }
    }

    signalEmitv([valueFromObject(this), ...paramValues] as Value[], signalId, detail);
}
GObject.prototype.emit = emitImpl;

const resolvePropertyValueType = (obj: GObject, propertyName: string): GType => {
    const pspecHandle = findObjectProperty(getHandle(obj), propertyName);
    if (!pspecHandle) {
        const className = obj.constructor.name || "GObject";
        throw new Error(`No property '${propertyName}' on ${className}`);
    }
    return valueGetType(getNativeObject<ParamSpec>(pspecHandle).getDefaultValue());
};

const dispatchPropertyCall = (fnName: string, obj: GObject, propertyName: string, gvalue: GValue): void => {
    call(
        LIBGOBJECT,
        fnName,
        [
            { type: GOBJECT_BORROWED, value: getHandle(obj) },
            { type: t.string("borrowed"), value: propertyName },
            { type: GVALUE_BORROWED, value: getHandle(gvalue) },
        ],
        t.void,
    );
};

GObject.prototype.getProperty = function getProperty(propertyName: string): unknown {
    const valueType = resolvePropertyValueType(this, propertyName);
    const gvalue = new GValue();
    gvalue.init(valueType);
    dispatchPropertyCall("g_object_get_property", this, propertyName, gvalue);
    return valueToJS(gvalue);
};

GObject.prototype.setProperty = function setProperty(propertyName: string, value: unknown): void {
    const valueType = resolvePropertyValueType(this, propertyName);
    const gvalue = valueFromJS(valueType, value);
    dispatchPropertyCall("g_object_set_property", this, propertyName, gvalue);
};
