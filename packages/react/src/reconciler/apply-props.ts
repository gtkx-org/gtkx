import type * as GObject from "@gtkx/gi/gobject";
import { isConstructOnlyProp, resolveDefaultProp, resolveSignal } from "../utils/gtype.js";
import { NOTIFY_DETAIL_PREFIX, notifyDetailToProp } from "../utils/notify-name.js";
import { applyArrayProp } from "./array-props.js";
import type { ImperativeHandler, PropDescriptorTable, SignalPropDescriptor } from "./prop-descriptor-table.js";
import type { SignalHandler } from "./signal-store.js";
import { stateOf } from "./state.js";
import type { Props } from "./types.js";

const notifyValueHandler = (container: GObject.Object, signalName: string, callback: SignalHandler): SignalHandler => {
    const prop = notifyDetailToProp(signalName);
    return () => callback(Reflect.get(container, prop), container);
};

const EMPTY_TABLE: PropDescriptorTable = {};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== "object" || value === null) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

const elementsEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (!isPlainObject(a) || !isPlainObject(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && a[key] === b[key]);
};

const propsEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((item, index) => elementsEqual(item, b[index]));
    }
    return false;
};

export type ApplyPropsOptions = {
    descriptors?: PropDescriptorTable;
    exclude?: (name: string) => boolean;
    defaultBlockable?: boolean;
};

export function applyProps(
    container: GObject.Object,
    oldProps: Props | null,
    newProps: Props,
    options?: ApplyPropsOptions,
): void {
    const context: ApplyContext = {
        container,
        oldProps,
        newProps,
        descriptors: options?.descriptors ?? EMPTY_TABLE,
    };

    applyGenericProps(context, options?.exclude, options?.defaultBlockable ?? true);
    applyDescriptors(context);
}

type ApplyContext = {
    container: GObject.Object;
    oldProps: Props | null;
    newProps: Props;
    descriptors: PropDescriptorTable;
};

type PendingSignal = { signalName: string; newValue: unknown };

type PendingProperty = { name: string; newValue: unknown };

const resolvePendingProperty = (
    container: GObject.Object,
    name: string,
    newValue: unknown,
): PendingProperty | undefined => {
    if (newValue !== undefined) return { name, newValue };
    const fallback = resolveDefaultProp(container, name);
    return fallback.has ? { name, newValue: fallback.value } : undefined;
};

const collectGenericChanges = (
    context: ApplyContext,
    exclude: ((name: string) => boolean) | undefined,
): { pendingSignals: PendingSignal[]; pendingProperties: PendingProperty[] } => {
    const { container, oldProps, newProps, descriptors } = context;
    const constructionApplied = oldProps === null;
    const pendingSignals: PendingSignal[] = [];
    const pendingProperties: PendingProperty[] = [];

    const collect = (name: string): void => {
        if (name === "children" || name in descriptors || exclude?.(name)) return;
        if (isConstructOnlyProp(container, name)) return;

        const oldValue = oldProps?.[name];
        const newValue = newProps[name];
        if (propsEqual(oldValue, newValue)) return;

        const signalName = resolveSignal(container, name);
        if (signalName) {
            pendingSignals.push({ signalName, newValue });
            return;
        }
        if (constructionApplied) return;
        const pending = resolvePendingProperty(container, name, newValue);
        if (pending) pendingProperties.push(pending);
    };

    if (oldProps) {
        for (const name in oldProps) collect(name);
        for (const name in newProps) {
            if (!(name in oldProps)) collect(name);
        }
    } else {
        for (const name in newProps) collect(name);
    }

    return { pendingSignals, pendingProperties };
};

const applyGenericProps = (
    context: ApplyContext,
    exclude: ((name: string) => boolean) | undefined,
    defaultBlockable: boolean,
): void => {
    const { container } = context;
    const { signalStore } = stateOf(container);
    const { pendingSignals, pendingProperties } = collectGenericChanges(context, exclude);

    for (const { signalName, newValue } of pendingSignals) {
        const callback = typeof newValue === "function" ? (newValue as SignalHandler) : undefined;
        const handler =
            callback && signalName.startsWith(NOTIFY_DETAIL_PREFIX)
                ? notifyValueHandler(container, signalName, callback)
                : callback;
        signalStore.set({
            owner: container,
            obj: container,
            signal: signalName,
            handler,
            blockable: defaultBlockable,
        });
    }

    for (const { name, newValue } of pendingProperties) {
        if (typeof newValue === "string" && Reflect.get(container, name) === newValue) continue;
        Reflect.set(container, name, newValue);
    }
};

const applyDescriptors = (context: ApplyContext): void => {
    const { container, oldProps, newProps, descriptors } = context;
    const ranImperatives = new Set<ImperativeHandler>();

    for (const [key, descriptor] of Object.entries(descriptors)) {
        const isEqual = descriptor.diff ?? propsEqual;
        const changed = !isEqual(oldProps?.[key], newProps[key]);
        switch (descriptor.kind) {
            case "array":
                if (changed) applyArrayProp(container, descriptor, oldProps?.[key], newProps[key]);
                break;
            case "signal":
                if (changed) applySignalDescriptor(container, newProps[key], descriptor);
                break;
            case "imperative":
                if ((descriptor.always || changed) && !ranImperatives.has(descriptor.handler)) {
                    ranImperatives.add(descriptor.handler);
                    descriptor.handler(container, newProps, oldProps);
                }
                break;
        }
    }
};

const applySignalDescriptor = (
    container: GObject.Object,
    callbackValue: unknown,
    descriptor: SignalPropDescriptor,
): void => {
    const handler =
        typeof callbackValue === "function"
            ? buildSignalHandler(callbackValue as SignalHandler, descriptor)
            : undefined;
    const blockable = descriptor.blockable ?? true;
    const { signalStore } = stateOf(container);

    for (const signalName of descriptor.signals) {
        signalStore.set({ owner: container, obj: container, signal: signalName, handler, blockable });
    }
};

const buildSignalHandler = (callback: SignalHandler, descriptor: SignalPropDescriptor): SignalHandler => {
    if (!descriptor.getArgs && descriptor.returnValue === undefined) return callback;

    return (...signalArgs: unknown[]) => {
        const args = descriptor.getArgs ? descriptor.getArgs() : signalArgs;
        if (args !== null) callback(...args);
        return descriptor.returnValue;
    };
};
