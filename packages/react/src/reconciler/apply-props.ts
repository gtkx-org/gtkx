import type * as GObject from "@gtkx/gi/gobject";
import type { SignalHandler } from "@gtkx/runtime";
import { isSameArrayBy, isShallowEqual } from "@gtkx/utils";
import { NOTIFY_DETAIL_PREFIX, notifyDetailToProp } from "../utils/notify-name.js";
import { isConstructOnlyProp, resolveDefaultProp, resolveSignal } from "../utils/type-metadata.js";
import { stateOf } from "./state.js";
import type { Props } from "./types.js";

const createNotifyValueHandler = (
    container: GObject.Object,
    signalName: string,
    handler: SignalHandler,
): SignalHandler => {
    const prop = notifyDetailToProp(signalName);
    return () => handler(Reflect.get(container, prop), container);
};

type ApplyPropsOptions = {
    exclude?: (name: string) => boolean;
};

type PendingSignal = { signalName: string; newValue: unknown };

type PendingProperty = { name: string; newValue: unknown };

type GenericChange = ({ kind: "signal" } & PendingSignal) | ({ kind: "property" } & PendingProperty);

const resolvePropChange = (
    container: GObject.Object,
    name: string,
    newValue: unknown,
    constructionApplied: boolean,
): GenericChange | null => {
    const signalName = resolveSignal(container, name);
    if (signalName) return { kind: "signal", signalName, newValue };
    if (constructionApplied) return null;
    if (newValue !== undefined) return { kind: "property", name, newValue };
    const fallback = resolveDefaultProp(container, name);
    return fallback.has ? { kind: "property", name, newValue: fallback.value } : null;
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
        if (oldValue === newValue) return;
        if (Array.isArray(oldValue) && Array.isArray(newValue) && isSameArrayBy(oldValue, newValue, isShallowEqual))
            return;

        const change = resolvePropChange(container, name, newValue, constructionApplied);
        if (change === null) return;
        if (change.kind === "signal") pendingSignals.push(change);
        else pendingProperties.push(change);
    };

    const names = new Set<string>();
    if (oldProps) for (const name in oldProps) names.add(name);
    for (const name in newProps) names.add(name);
    for (const name of names) collect(name);

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
                ? createNotifyValueHandler(container, signalName, nextHandler)
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
