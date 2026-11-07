import {
    disconnectSignal,
    getHandle,
    offSignal,
    onceSignal,
    onSignal,
    type SignalHandler,
    type SignalHandlerId,
    t,
    toClosure,
    tryToClosure,
} from "@gtkx/runtime";
import {
    type BindingTransform,
    fromValue,
    intoValue,
    type SignalHandlerFor,
    type SignalMethodReceiver,
    type SignalName,
} from "@gtkx/runtime/internal";
import { Binding, BindingGroup, type Closure, Object as GObject, type Value } from "../gobject.js";

declare module "../gobject.js" {
    interface Object {
        /** GType the instance's class is registered under, carried on the prototype. */
        __type__: Type;

        /**
         * Disconnects the handler `connect` returned the given id for.
         *
         * @param handlerId Id of the handler to disconnect.
         */
        disconnect<TThis extends object>(
            this: TThis & SignalMethodReceiver<TThis, "disconnect">,
            handlerId: SignalHandlerId,
        ): void;

        /**
         * Connects a handler that runs on every emission of `sigName`, remembering it so `off` can
         * take the same callback back off again.
         *
         * @param sigName Signal to connect to.
         * @param callback Handler invoked on each emission.
         * @param isAfter Run the handler after the default handler rather than before it.
         * @returns The same object, so calls chain.
         */
        on<TThis extends object, K extends SignalName<TThis>>(
            this: TThis & SignalMethodReceiver<TThis, "on">,
            sigName: K,
            callback: SignalHandlerFor<TThis, K>,
            isAfter?: boolean,
        ): TThis;

        /**
         * Connects a handler that runs at most once and disconnects itself after the first emission.
         *
         * @param sigName Signal to connect to.
         * @param callback Handler invoked on the first emission.
         * @param isAfter Run the handler after the default handler rather than before it.
         * @returns The same object, so calls chain.
         */
        once<TThis extends object, K extends SignalName<TThis>>(
            this: TThis & SignalMethodReceiver<TThis, "once">,
            sigName: K,
            callback: SignalHandlerFor<TThis, K>,
            isAfter?: boolean,
        ): TThis;

        /**
         * Disconnects a handler previously connected with `on` or `once`, given the same callback.
         *
         * @param sigName Signal the handler was connected to.
         * @param callback The handler that was connected.
         * @returns The same object, so calls chain.
         */
        off<TThis extends object, K extends SignalName<TThis>>(
            this: TThis & SignalMethodReceiver<TThis, "off">,
            sigName: K,
            callback: SignalHandlerFor<TThis, K>,
        ): TThis;
    }
}

type Transform<TFrom, TTo> = BindingTransform<Binding, TFrom, TTo> | Closure | null | undefined;

const LIBRARY = "libgobject-2.0.so.0";
const CLOSURE_ARG = {
    type: t.boxed("GClosure", { ownership: "borrowed", sharedLibrary: LIBRARY, getTypeFnName: "g_closure_get_type" }),
};
const BINDING_ARGS = [
    { type: t.string("borrowed"), isRequired: true },
    { type: t.object("borrowed", undefined, "GObject"), isRequired: true },
    { type: t.string("borrowed"), isRequired: true },
    { type: t.flags(LIBRARY, "g_binding_flags_get_type", false), isRequired: true },
    CLOSURE_ARG,
    CLOSURE_ARG,
];

const bindPropertyWithClosures = t.fn(LIBRARY, "g_object_bind_property_with_closures", () => ({
    args: [{ type: t.object("borrowed", undefined, "GObject") }, ...BINDING_ARGS],
    returns: t.object("borrowed", () => Binding, "GBinding"),
}));

const bindingGroupBindWithClosures = t.fn(LIBRARY, "g_binding_group_bind_with_closures", () => ({
    args: [{ type: t.object("borrowed", undefined, "GBindingGroup") }, ...BINDING_ARGS],
    returns: t.void,
}));

const isTransformResult = (result: unknown): result is [boolean, unknown] =>
    Array.isArray(result) && typeof result[0] === "boolean";

const transformClosure = <TFrom, TTo>(transform: Transform<TFrom, TTo>): ReturnType<typeof tryToClosure> => {
    if (typeof transform !== "function") {
        return tryToClosure(transform);
    }

    return toClosure((binding: Binding, from: Value, to: Value): boolean => {
        const result: unknown = transform(binding, fromValue(getHandle(from)) as TFrom);

        if (!isTransformResult(result)) {
            throw new TypeError("A binding transform function must return [success, value]");
        }

        const [succeeded, value] = result;

        if (succeeded) {
            intoValue(getHandle(to), value);
        }

        return succeeded;
    });
};

GObject.prototype.bindPropertyFull = function (
    sourceProperty,
    target,
    targetProperty,
    flags,
    transformTo,
    transformFrom,
): Binding {
    return bindPropertyWithClosures(
        getHandle(this),
        sourceProperty,
        getHandle(target),
        targetProperty,
        flags,
        transformClosure(transformTo),
        transformClosure(transformFrom),
    ) as Binding;
};

BindingGroup.prototype.bindFull = function (
    sourceProperty,
    target,
    targetProperty,
    flags,
    transformTo,
    transformFrom,
): void {
    bindingGroupBindWithClosures(
        getHandle(this),
        sourceProperty,
        getHandle(target),
        targetProperty,
        flags,
        transformClosure(transformTo),
        transformClosure(transformFrom),
    );
};

GObject.prototype.disconnect = function <TThis extends object>(this: TThis, handlerId: SignalHandlerId): void {
    disconnectSignal(this, handlerId);
};

GObject.prototype.on = function <TThis extends object, K extends SignalName<TThis>>(
    this: TThis,
    signal: K,
    handler: SignalHandler & SignalHandlerFor<TThis, K>,
    isAfter?: boolean,
): TThis {
    onSignal(this, signal, handler, isAfter);

    return this;
};

GObject.prototype.once = function <TThis extends object, K extends SignalName<TThis>>(
    this: TThis,
    signal: K,
    handler: SignalHandler & SignalHandlerFor<TThis, K>,
    isAfter?: boolean,
): TThis {
    onceSignal(this, signal, handler, isAfter);

    return this;
};

GObject.prototype.off = function <TThis extends object, K extends SignalName<TThis>>(
    this: TThis,
    signal: K,
    handler: SignalHandler & SignalHandlerFor<TThis, K>,
): TThis {
    offSignal(this, signal, handler);

    return this;
};
