/**
 * The renderer's single prop-application algorithm.
 *
 * Every real-GObject instance commits its props through {@link applyProps}: a
 * generic diff-classify-apply pass that routes each changed prop to a GObject
 * signal or a GObject property, plus two declarative tables for props that need
 * bespoke handling — the {@link "../../array-props".ARRAY_PROPS} table for
 * array-valued props and a {@link PropDescriptorTable} for signal/imperative
 * props the host config supplies.
 *
 * Three descriptor sources cover every case. The generic path handles plain
 * GObject signals and properties. The array-prop table reconciles array elements
 * into repeated GTK calls. The descriptor table's {@link signal} wires a callback
 * prop to GObject signals and {@link imperative} runs a side-effecting handler.
 * A prop named in any table bypasses the generic path.
 */
import { toCamelCase } from "@gtkx/utils";
import { type ArrayPropDescriptor, applyArrayProp, collectArrayProps } from "../../array-props.js";
import { isConstructOnlyProp, resolveDefaultProp, resolveSignal } from "../../gtype.js";
import type { Instance } from "../../instance.js";
import type { BackingInstance, Props } from "../../types.js";
import { isEditable } from "./predicates.js";
import type { SignalHandler } from "./signal-store.js";

const NOTIFY_DETAIL_PREFIX = "notify::";

/**
 * Wraps a callback bound to a `notify::<prop>` signal so it receives the
 * property's current value (and the object), rather than the raw `GParamSpec`.
 */
const notifyValueHandler = (container: BackingInstance, signalName: string, callback: SignalHandler): SignalHandler => {
    const prop = toCamelCase(signalName.slice(NOTIFY_DETAIL_PREFIX.length));
    return () => callback(Reflect.get(container, prop), container);
};

/**
 * Descriptor for a prop whose value is a callback bound to GObject signals.
 *
 * @see {@link signal}
 */
export interface SignalPropDescriptor {
    readonly kind: "signal";
    readonly signals: readonly string[];
    readonly blockable?: boolean;
    readonly getArgs?: () => readonly unknown[] | null;
    readonly returnValue?: unknown;
}

/** A bespoke prop's side-effecting handler; receives the previous props. */
export type ImperativeHandler = (oldProps: Props | null) => void;

/**
 * Descriptor for a prop applied by running a side-effecting handler.
 *
 * @see {@link imperative}
 */
export interface ImperativeDescriptor {
    readonly kind: "imperative";
    readonly handler: ImperativeHandler;
    readonly always: boolean;
}

/** A descriptor for one bespoke prop. */
type PropDescriptor = SignalPropDescriptor | ImperativeDescriptor;

/** A node's bespoke props, keyed by prop name. */
export type PropDescriptorTable = Record<string, PropDescriptor>;

const EMPTY_TABLE: PropDescriptorTable = {};

/**
 * Builds a {@link SignalPropDescriptor}.
 *
 * @param signals - GObject signal name, or names, the callback connects to
 * @param options - `blockable` overrides whether the handler is suppressed
 *   during commits (default `true`); `getArgs` computes the arguments the
 *   callback receives, returning `null` to skip the call (default: the raw
 *   signal arguments); `returnValue` is the value the GObject handler returns
 */
export function signal(
    signals: string | readonly string[],
    options?: Omit<SignalPropDescriptor, "kind" | "signals">,
): SignalPropDescriptor {
    return {
        kind: "signal",
        signals: typeof signals === "string" ? [signals] : signals,
        ...options,
    };
}

/**
 * Builds an {@link ImperativeDescriptor}.
 *
 * Several prop keys may share one handler reference; the shared handler then
 * runs once per commit when any of those props change. With `always`, the
 * handler runs on every commit regardless of whether its props changed.
 *
 * @param handler - side-effecting handler applied to the widget
 * @param options - `always` forces the handler to run on every commit
 */
export function imperative(handler: ImperativeHandler, options?: { always?: boolean }): ImperativeDescriptor {
    return { kind: "imperative", handler, always: options?.always ?? false };
}

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
    /** The node's bespoke-prop descriptors; table keys bypass the generic path. */
    readonly table?: PropDescriptorTable;
    /** Prop names to omit from the generic path (e.g. accessible props). */
    readonly exclude?: (name: string) => boolean;
    /** Whether generic signal handlers are suppressed during commits. */
    readonly defaultBlockable?: boolean;
};

/**
 * Applies a prop commit to an instance's backing GObject.
 *
 * Props named in the array-prop table or `options.table` are handled by their
 * descriptors; every other prop flows through the generic path, which classifies
 * it as a GObject signal or a GObject property and applies the change.
 *
 * @param instance - the reconciler instance being committed
 * @param oldProps - the previously-committed props, or `null` on first mount
 * @param newProps - the props to apply
 * @param options - descriptor table and generic-path tuning
 */
export function applyProps(
    instance: Instance,
    oldProps: Props | null,
    newProps: Props,
    options?: ApplyPropsOptions,
): void {
    const container = instance.backingInstance;
    if (!container) return;

    const context: ApplyContext = {
        instance,
        container,
        oldProps,
        newProps,
        table: options?.table ?? EMPTY_TABLE,
        arrayProps: collectArrayProps(container),
    };

    applyGenericProps(context, options?.exclude, options?.defaultBlockable ?? true);
    applyArrayProps(context);
    applyTableDescriptors(context);
}

type ApplyContext = {
    readonly instance: Instance;
    readonly container: BackingInstance;
    readonly oldProps: Props | null;
    readonly newProps: Props;
    readonly table: PropDescriptorTable;
    readonly arrayProps: ReadonlyMap<string, ArrayPropDescriptor>;
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
    container: BackingInstance,
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
    const { container, oldProps, newProps, table, arrayProps } = context;
    const names = new Set([...Object.keys(oldProps ?? {}), ...Object.keys(newProps)]);
    const constructionApplied = oldProps === null;
    const pendingSignals: PendingSignal[] = [];
    const pendingProperties: PendingProperty[] = [];

    for (const name of names) {
        if (name === "children" || name in table || arrayProps.has(name) || exclude?.(name)) continue;
        if (isConstructOnlyProp(container, name)) continue;

        const oldValue = oldProps?.[name];
        const newValue = newProps[name];
        if (propsEqual(oldValue, newValue)) continue;

        const signalName = resolveSignal(container, name);
        if (signalName) {
            pendingSignals.push({ signalName, newValue });
            continue;
        }
        if (constructionApplied) continue;
        const pending = resolvePendingProperty(container, name, oldValue, newValue);
        if (pending) pendingProperties.push(pending);
    }

    return { pendingSignals, pendingProperties };
};

const applyGenericProps = (
    context: ApplyContext,
    exclude: ((name: string) => boolean) | undefined,
    defaultBlockable: boolean,
): void => {
    const { instance, container } = context;
    const { pendingSignals, pendingProperties } = collectGenericChanges(context, exclude);

    for (const { signalName, newValue } of pendingSignals) {
        const callback = typeof newValue === "function" ? (newValue as SignalHandler) : undefined;
        const handler =
            callback && signalName.startsWith(NOTIFY_DETAIL_PREFIX)
                ? notifyValueHandler(container, signalName, callback)
                : callback;
        instance.signalStore.set({
            owner: instance,
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

const applyArrayProps = (context: ApplyContext): void => {
    const { container, oldProps, newProps, arrayProps } = context;
    for (const [name, descriptor] of arrayProps) {
        const oldValue = oldProps?.[name];
        const newValue = newProps[name];
        if (propsEqual(oldValue, newValue)) continue;
        applyArrayProp(container, descriptor, oldValue, newValue);
    }
};

const applyTableDescriptors = (context: ApplyContext): void => {
    const { instance, container, oldProps, newProps, table } = context;
    const ranImperatives = new Set<ImperativeHandler>();

    for (const [key, descriptor] of Object.entries(table)) {
        switch (descriptor.kind) {
            case "signal":
                if (!propsEqual(oldProps?.[key], newProps[key])) {
                    applySignalDescriptor(instance, container, newProps[key], descriptor);
                }
                break;
            case "imperative":
                if (
                    (descriptor.always || !propsEqual(oldProps?.[key], newProps[key])) &&
                    !ranImperatives.has(descriptor.handler)
                ) {
                    ranImperatives.add(descriptor.handler);
                    descriptor.handler(oldProps);
                }
                break;
        }
    }
};

const applySignalDescriptor = (
    instance: Instance,
    container: BackingInstance,
    callbackValue: unknown,
    descriptor: SignalPropDescriptor,
): void => {
    const handler =
        typeof callbackValue === "function"
            ? buildSignalHandler(callbackValue as SignalHandler, descriptor)
            : undefined;
    const blockable = descriptor.blockable ?? true;

    for (const signalName of descriptor.signals) {
        instance.signalStore.set({ owner: instance, obj: container, signal: signalName, handler, blockable });
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
