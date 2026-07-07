import type { SignalHandler } from "@gtkx/ffi";
import type * as GObject from "@gtkx/gi/gobject";
import { isConstructOnlyProp, resolveDefaultProp, resolveSignal } from "../utils/gtype.js";
import { NOTIFY_DETAIL_PREFIX, notifyDetailToProp } from "../utils/notify-name.js";
import { stateOf } from "./state.js";
import type { Props } from "./types.js";

const notifyValueHandler = (container: GObject.Object, signalName: string, handler: SignalHandler): SignalHandler => {
    const prop = notifyDetailToProp(signalName);
    return () => handler(Reflect.get(container, prop), container);
};

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

type ApplyPropsOptions = {
    exclude?: (name: string) => boolean;
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
    container: GObject.Object,
    oldProps: Props | null,
    newProps: Props,
    exclude: ((name: string) => boolean) | undefined,
): { pendingSignals: PendingSignal[]; pendingProperties: PendingProperty[] } => {
    const constructionApplied = oldProps === null;
    const pendingSignals: PendingSignal[] = [];
    const pendingProperties: PendingProperty[] = [];

    const collect = (name: string): void => {
        if (name === "children" || exclude?.(name)) return;
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

export function applyProps(
    container: GObject.Object,
    oldProps: Props | null,
    newProps: Props,
    options?: ApplyPropsOptions,
): void {
    const { signalStore } = stateOf(container);
    const { pendingSignals, pendingProperties } = collectGenericChanges(
        container,
        oldProps,
        newProps,
        options?.exclude,
    );

    for (const { signalName, newValue } of pendingSignals) {
        const nextHandler = typeof newValue === "function" ? (newValue as SignalHandler) : undefined;
        const handler =
            nextHandler && signalName.startsWith(NOTIFY_DETAIL_PREFIX)
                ? notifyValueHandler(container, signalName, nextHandler)
                : nextHandler;
        signalStore.set({
            instance: container,
            signal: signalName,
            handler,
        });
    }

    for (const { name, newValue } of pendingProperties) {
        if (typeof newValue === "string" && Reflect.get(container, name) === newValue) continue;
        Reflect.set(container, name, newValue);
    }
}
