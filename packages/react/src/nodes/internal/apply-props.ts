/**
 * The renderer's single prop-application algorithm.
 *
 * Every reconciler node commits its props through {@link applyProps}: a generic
 * diff-classify-apply pass that routes each changed prop to a GObject signal or
 * a GObject property, plus a declarative descriptor table for props that need
 * bespoke handling.
 *
 * A node contributes its bespoke props by overriding `ownPropDescriptors()` and
 * returning a {@link PropDescriptorTable}. The table keys double as the filter
 * list — keys present in the table are handled by their descriptor and skipped
 * by the generic path, so there is no separate list of own-prop names to keep
 * in sync.
 *
 * Three descriptor kinds cover every case: {@link signal} wires a callback prop
 * to one or more GObject signals, {@link imperative} runs a side-effecting
 * handler when the prop changes, and {@link arraySync} reconciles an array prop
 * against the widget through clear/add operations.
 */
import { isConstructOnlyProp, resolvePropMeta, resolveSignal } from "../../metadata.js";
import type { Node } from "../../node.js";
import type { Container, Props } from "../../types.js";
import { isEditable } from "./predicates.js";
import type { SignalHandler } from "./signal-store.js";

/**
 * Descriptor for a prop whose value is a callback bound to GObject signals.
 *
 * @see {@link signal}
 */
export interface SignalDescriptor {
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

/**
 * Descriptor for an array prop reconciled against the widget by clearing the
 * previously-applied items and adding the current ones.
 *
 * @see {@link arraySync}
 */
export interface ArraySyncDescriptor {
    readonly kind: "arraySync";
    readonly equal: (a: readonly unknown[], b: readonly unknown[]) => boolean;
    readonly clearAll?: () => void;
    readonly clearItem?: (handle: unknown) => void;
    readonly add: (item: unknown) => unknown;
}

/** A descriptor for one bespoke prop. */
export type PropDescriptor = SignalDescriptor | ImperativeDescriptor | ArraySyncDescriptor;

/** A node's bespoke props, keyed by prop name. */
export type PropDescriptorTable = Record<string, PropDescriptor>;

const EMPTY_TABLE: PropDescriptorTable = {};

/**
 * Builds a {@link SignalDescriptor}.
 *
 * @param signals - GObject signal name, or names, the callback connects to
 * @param options - `blockable` overrides whether the handler is suppressed
 *   during commits (default `true`); `getArgs` computes the arguments the
 *   callback receives, returning `null` to skip the call (default: the raw
 *   signal arguments); `returnValue` is the value the GObject handler returns
 */
export function signal(
    signals: string | readonly string[],
    options?: Omit<SignalDescriptor, "kind" | "signals">,
): SignalDescriptor {
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

/**
 * Builds an {@link ArraySyncDescriptor}.
 *
 * The previously-applied items are cleared — through `clearAll`, or per item
 * through `clearItem` with the handle `add` returned — and the current items
 * are added. `equal` short-circuits the reconciliation when the array is
 * unchanged.
 *
 * @param options - `equal` compares the applied items against the next ones;
 *   `clearAll`/`clearItem` remove the applied items; `add` applies one item and
 *   returns a handle passed back to `clearItem`
 */
export function arraySync<TItem, THandle>(options: {
    equal: (a: readonly TItem[], b: readonly TItem[]) => boolean;
    clearAll?: () => void;
    clearItem?: (handle: THandle) => void;
    add: (item: TItem) => THandle;
}): ArraySyncDescriptor {
    return { kind: "arraySync", ...options } as ArraySyncDescriptor;
}

type ArraySyncState = { items: readonly unknown[]; handles: unknown[] };

const arraySyncStates = new WeakMap<Node, Map<string, ArraySyncState>>();

const getArraySyncState = (node: Node, key: string): ArraySyncState => {
    let nodeStates = arraySyncStates.get(node);
    if (!nodeStates) {
        nodeStates = new Map();
        arraySyncStates.set(node, nodeStates);
    }
    let state = nodeStates.get(key);
    if (!state) {
        state = { items: [], handles: [] };
        nodeStates.set(key, state);
    }
    return state;
};

/** Options for {@link applyProps}. */
export interface ApplyPropsOptions {
    /** The node's bespoke-prop descriptors; table keys bypass the generic path. */
    readonly table?: PropDescriptorTable;
    /** Prop names to omit from the generic path (e.g. accessible props). */
    readonly exclude?: (name: string) => boolean;
    /** Whether generic signal handlers are suppressed during commits. */
    readonly defaultBlockable?: boolean;
}

/**
 * Applies a prop commit to a node's container.
 *
 * Props named in `options.table` are handled by their descriptor; every other
 * prop flows through the generic path, which classifies it as a GObject signal
 * or a GObject property and applies the change.
 *
 * @param node - the reconciler node being committed
 * @param oldProps - the previously-committed props, or `null` on first mount
 * @param newProps - the props to apply
 * @param options - descriptor table and generic-path tuning
 */
export function applyProps(node: Node, oldProps: Props | null, newProps: Props, options?: ApplyPropsOptions): void {
    const context: ApplyContext = {
        node,
        container: node.container as Container,
        oldProps,
        newProps,
        table: options?.table ?? EMPTY_TABLE,
    };

    applyGenericProps(context, options?.exclude, options?.defaultBlockable ?? true);
    applyTableDescriptors(context);
}

interface ApplyContext {
    readonly node: Node;
    readonly container: Container;
    readonly oldProps: Props | null;
    readonly newProps: Props;
    readonly table: PropDescriptorTable;
}

/**
 * Resets the array-sync state a node accumulated through {@link applyProps},
 * clearing each tracked array prop from the widget.
 *
 * @param node - the node being detached
 * @param table - the node's descriptor table
 */
export function teardownNode(node: Node, table: PropDescriptorTable): void {
    const nodeStates = arraySyncStates.get(node);
    if (!nodeStates) return;

    for (const [key, state] of nodeStates) {
        const descriptor = table[key];
        if (descriptor?.kind !== "arraySync") continue;
        if (descriptor.clearAll) {
            descriptor.clearAll();
        } else if (descriptor.clearItem) {
            for (const handle of state.handles) {
                descriptor.clearItem(handle);
            }
        }
    }

    arraySyncStates.delete(node);
}

type PendingSignal = { signalName: string; newValue: unknown };

type PendingProperty = { name: string; oldValue: unknown; newValue: unknown };

const collectGenericChanges = (
    context: ApplyContext,
    exclude: ((name: string) => boolean) | undefined,
): { pendingSignals: PendingSignal[]; pendingProperties: PendingProperty[] } => {
    const { container, oldProps, newProps, table } = context;
    const names = new Set([...Object.keys(oldProps ?? {}), ...Object.keys(newProps)]);
    const pendingSignals: PendingSignal[] = [];
    const pendingProperties: PendingProperty[] = [];

    for (const name of names) {
        if (name === "children" || name in table || exclude?.(name)) continue;
        if (isConstructOnlyProp(container, name)) continue;

        const oldValue = oldProps?.[name];
        const newValue = newProps[name];
        if (oldValue === newValue) continue;

        const signalName = resolveSignal(container, name);
        if (signalName) {
            pendingSignals.push({ signalName, newValue });
        } else if (newValue !== undefined) {
            pendingProperties.push({ name, oldValue, newValue });
        }
    }

    return { pendingSignals, pendingProperties };
};

const applyGenericProps = (
    context: ApplyContext,
    exclude: ((name: string) => boolean) | undefined,
    defaultBlockable: boolean,
): void => {
    const { node, container } = context;
    const { pendingSignals, pendingProperties } = collectGenericChanges(context, exclude);

    for (const { signalName, newValue } of pendingSignals) {
        const handler = typeof newValue === "function" ? (newValue as SignalHandler) : undefined;
        node.signalStore.set({ owner: node, obj: container, signal: signalName, handler, blockable: defaultBlockable });
    }

    for (const { name, oldValue, newValue } of pendingProperties) {
        if (name === "text" && oldValue !== undefined && isEditable(container) && oldValue !== container.getText()) {
            continue;
        }
        setProperty(container, name, newValue);
    }
};

const setProperty = (container: Container, key: string, value: unknown): void => {
    const propName = resolvePropMeta(container, key);
    if (!propName) return;
    if (typeof value === "string" && Reflect.get(container, propName) === value) return;
    Reflect.set(container, propName, value);
};

const applyTableDescriptors = (context: ApplyContext): void => {
    const { node, container, oldProps, newProps, table } = context;
    const ranImperatives = new Set<ImperativeHandler>();

    for (const [key, descriptor] of Object.entries(table)) {
        switch (descriptor.kind) {
            case "signal":
                if (oldProps?.[key] !== newProps[key]) {
                    applySignalDescriptor(node, container, newProps[key], descriptor);
                }
                break;
            case "imperative":
                if (
                    (descriptor.always || oldProps?.[key] !== newProps[key]) &&
                    !ranImperatives.has(descriptor.handler)
                ) {
                    ranImperatives.add(descriptor.handler);
                    descriptor.handler(oldProps);
                }
                break;
            case "arraySync":
                applyArraySyncDescriptor(node, key, descriptor, newProps[key]);
                break;
        }
    }
};

const applySignalDescriptor = (
    node: Node,
    container: Container,
    callbackValue: unknown,
    descriptor: SignalDescriptor,
): void => {
    const handler =
        typeof callbackValue === "function"
            ? buildSignalHandler(callbackValue as SignalHandler, descriptor)
            : undefined;
    const blockable = descriptor.blockable ?? true;

    for (const signalName of descriptor.signals) {
        node.signalStore.set({ owner: node, obj: container, signal: signalName, handler, blockable });
    }
};

const buildSignalHandler = (callback: SignalHandler, descriptor: SignalDescriptor): SignalHandler => {
    if (!descriptor.getArgs && descriptor.returnValue === undefined) return callback;

    return (...signalArgs: unknown[]) => {
        const args = descriptor.getArgs ? descriptor.getArgs() : signalArgs;
        if (args !== null) callback(...args);
        return descriptor.returnValue;
    };
};

const applyArraySyncDescriptor = (
    node: Node,
    key: string,
    descriptor: ArraySyncDescriptor,
    newValue: unknown,
): void => {
    const newItems = (newValue as readonly unknown[] | undefined) ?? [];
    const state = getArraySyncState(node, key);
    if (descriptor.equal(state.items, newItems)) return;

    if (descriptor.clearAll) {
        descriptor.clearAll();
    } else if (descriptor.clearItem) {
        for (const handle of state.handles) {
            descriptor.clearItem(handle);
        }
    }

    state.handles = newItems.map((item) => descriptor.add(item));
    state.items = [...newItems];
};
