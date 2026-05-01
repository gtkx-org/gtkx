import type { NativeHandle } from "@gtkx/native";
import { typeClassRef, typeFromName, typeNameFromInstance } from "../generated/gobject/functions.js";
import { Object as GObject } from "../generated/gobject/object.js";
import { ObjectClass } from "../generated/gobject/object-class.js";
import { TypeInstance } from "../generated/gobject/type-instance.js";
import { Value } from "../generated/gobject/value.js";
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

        /**
         * Reads a property by name and returns it as a plain JavaScript value.
         *
         * The property's GType is resolved at runtime via the object's class,
         * a GValue is initialized with that type, populated by
         * `g_object_get_property`, and finally unmarshalled via {@link Value.toJS}.
         *
         * @param propertyName - The property name (kebab-case GIR name)
         * @throws if no property with that name exists on this object's class
         */
        getProperty(propertyName: string): unknown;

        /**
         * Sets a property by name from a plain JavaScript value.
         *
         * The property's GType is resolved at runtime via the object's class,
         * `value` is marshalled via {@link Value.fromJS}, and the resulting
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

const LIB = "libgobject-2.0.so.0";
const GVALUE_SIZE = 24;

const GVALUE_BORROWED_TYPE = {
    type: "boxed",
    ownership: "borrowed",
    innerType: "GValue",
    library: LIB,
    getTypeFn: "g_value_get_type",
} as const;

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
    let handlerId = 0;
    const wrapped: Listener = (...args: unknown[]) => {
        untrackListener(this as GObject, signal, wrapped);
        untrackListener(this as GObject, signal, handler);
        (this as GObject).disconnect(handlerId);
        return handler(...args);
    };
    handlerId = (this as GObject).connect(signal, wrapped, after);
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

const resolveObjectClass = (obj: GObject): ObjectClass => {
    const typeInstance = getNativeObject(obj.handle, TypeInstance);
    const runtimeTypeName = typeNameFromInstance(typeInstance);
    const gtype = typeFromName(runtimeTypeName);
    const typeClass = typeClassRef(gtype);
    return getNativeObject(typeClass.handle, ObjectClass);
};

const resolvePropertyValueType = (obj: GObject, propertyName: string): number => {
    const objectClass = resolveObjectClass(obj);
    const pspec = objectClass.findProperty(propertyName);
    if (!pspec) {
        const ctor = obj.constructor as { name?: string; glibTypeName?: string };
        const className = ctor.glibTypeName ?? ctor.name ?? "GObject";
        throw new Error(`No property '${propertyName}' on ${className}`);
    }
    return pspec.getDefaultValue().getType();
};

GObject.prototype.getProperty = function getProperty(propertyName: string): unknown {
    const valueType = resolvePropertyValueType(this, propertyName);
    const gvalue = new Value();
    gvalue.init(valueType);
    call(
        LIB,
        "g_object_get_property",
        [
            { type: { type: "gobject", ownership: "borrowed" }, value: this.handle },
            { type: { type: "string", ownership: "borrowed" }, value: propertyName },
            { type: GVALUE_BORROWED_TYPE, value: gvalue.handle },
        ],
        { type: "void" },
    );
    return gvalue.toJS();
};

GObject.prototype.setProperty = function setProperty(propertyName: string, value: unknown): void {
    const valueType = resolvePropertyValueType(this, propertyName);
    const gvalue = Value.fromJS(valueType, value);
    call(
        LIB,
        "g_object_set_property",
        [
            { type: { type: "gobject", ownership: "borrowed" }, value: this.handle },
            { type: { type: "string", ownership: "borrowed" }, value: propertyName },
            { type: GVALUE_BORROWED_TYPE, value: gvalue.handle },
        ],
        { type: "void" },
    );
};
