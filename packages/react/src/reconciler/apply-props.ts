/**
 * The renderer's single prop-application algorithm.
 *
 * Every real-GObject instance commits its props through {@link applyProps}: a
 * generic diff-classify-apply pass that routes each changed prop to a GObject
 * signal or a GObject property, plus one declarative {@link PropDescriptorTable}
 * — the unified per-GType descriptor view the host config supplies — for props
 * that need bespoke handling.
 *
 * Each descriptor is one of three kinds. An {@link ArrayPropDescriptor}
 * reconciles array elements into repeated GTK calls; a {@link signal} descriptor
 * wires a callback prop to GObject signals; an {@link imperative} descriptor runs
 * a side-effecting handler against the backing GObject. A prop named in the
 * descriptor view bypasses the generic path; every other prop flows through it.
 */

import type * as GObject from "@gtkx/gi/gobject";
import { isConstructOnlyProp, resolveDefaultProp, resolveSignal } from "../utils/gtype.js";
import { NOTIFY_DETAIL_PREFIX, notifyDetailToProp } from "../utils/notify-name.js";
import { applyArrayProp } from "./array-props.js";
import { isEditable } from "./predicates.js";
import type { ImperativeHandler, PropDescriptorTable, SignalPropDescriptor } from "./prop-descriptor-table.js";
import type { SignalHandler } from "./signal-store.js";
import { stateOf } from "./state.js";
import type { Props } from "./types.js";

/**
 * Wraps a callback bound to a `notify::<prop>` signal so it receives the
 * property's current value (and the object), rather than the raw `GParamSpec`.
 */
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

/**
 * Whether two prop values are equal for change detection: identical references,
 * or arrays of equal length whose elements match (by reference, or — for plain
 * data objects only — by a one-level key comparison). Widgets, GObjects, and
 * functions inside arrays fall back to reference equality, never a deep walk, so
 * content-stable inline arrays do not trigger redundant re-application.
 */
const propsEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((item, index) => elementsEqual(item, b[index]));
    }
    return false;
};

/** Options for {@link applyProps}. */
export type ApplyPropsOptions = {
    /** The node's per-GType descriptor view; described props bypass the generic path. */
    readonly descriptors?: PropDescriptorTable;
    /** Prop names to omit from the generic path (e.g. accessible props). */
    readonly exclude?: (name: string) => boolean;
    /** Whether generic signal handlers are suppressed during commits. */
    readonly defaultBlockable?: boolean;
};

/**
 * Applies a prop commit to a real element's backing GObject.
 *
 * Props named in `options.descriptors` are handled by their descriptor (array,
 * signal, or imperative); every other prop flows through the generic path, which
 * classifies it as a GObject signal or a GObject property and applies the change.
 *
 * @param container - the backing GObject being committed
 * @param oldProps - the previously-committed props, or `null` on first mount
 * @param newProps - the props to apply
 * @param options - descriptor view and generic-path tuning
 */
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
    readonly container: GObject.Object;
    readonly oldProps: Props | null;
    readonly newProps: Props;
    readonly descriptors: PropDescriptorTable;
};

type PendingSignal = { signalName: string; newValue: unknown };

type PendingProperty = { name: string; oldValue: unknown; newValue: unknown };

/**
 * Resolves the property change a non-signal prop contributes: the new value
 * when present, or — when the prop was removed — its GIR default so the widget
 * resets to its initial state. Returns `undefined` when a removed prop has no
 * known default and is therefore left untouched.
 */
const resolvePendingProperty = (
    container: GObject.Object,
    name: string,
    oldValue: unknown,
    newValue: unknown,
): PendingProperty | undefined => {
    if (newValue !== undefined) return { name, oldValue, newValue };
    const fallback = resolveDefaultProp(container, name);
    return fallback.has ? { name, oldValue, newValue: fallback.value } : undefined;
};

/**
 * Classifies each changed prop into a pending GObject signal connection or a
 * pending property write.
 *
 * On first mount (`oldProps === null`) the backing GObject was just constructed
 * through `g_object_new_with_properties`, which already wrote every plain
 * property in the bag. The generic property writes are therefore skipped on
 * mount — re-reading or re-setting a value construction already applied is pure
 * FFI traffic — while signal connections, which construction never makes, are
 * still collected.
 */
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
        const pending = resolvePendingProperty(container, name, oldValue, newValue);
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

    for (const { name, oldValue, newValue } of pendingProperties) {
        if (name === "text" && oldValue !== undefined && isEditable(container) && oldValue !== container.getText()) {
            continue;
        }
        if (typeof newValue === "string" && Reflect.get(container, name) === newValue) continue;
        Reflect.set(container, name, newValue);
    }
};

/**
 * Applies every described prop in one pass over the unified descriptor view.
 *
 * An array descriptor reconciles its elements on identity change; a signal
 * descriptor rewires its connection on change; an imperative descriptor runs its
 * handler when its prop changes or when `always` forces it every commit. Several
 * prop keys may share one imperative handler reference (e.g. a setter group), so
 * `ranImperatives` dedupes it to a single run per commit.
 */
const applyDescriptors = (context: ApplyContext): void => {
    const { container, oldProps, newProps, descriptors } = context;
    const ranImperatives = new Set<ImperativeHandler>();

    for (const [key, descriptor] of Object.entries(descriptors)) {
        const changed = !propsEqual(oldProps?.[key], newProps[key]);
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
                    descriptor.handler(container, newProps);
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
