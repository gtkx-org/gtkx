import { typeName } from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { freeze, unfreeze } from "@gtkx/native";
import React from "react";
import type ReactReconciler from "react-reconciler";
import { DiscreteEventPriority } from "react-reconciler/constants.js";
import { createNode, resolveContainerClass } from "./factory.js";
import type { Node } from "./node.js";
import { isBuffered } from "./nodes/internal/predicates.js";
import { beginCommit, drainAfterCommit, endCommit } from "./post-commit-queue.js";
import { reportReconcilerError } from "./reconciler-error-sink.js";
import type { BackingInstance, Props } from "./types.js";

declare global {
    var __GTKX_CONTAINER_NODE_CACHE__: WeakMap<BackingInstance, Node> | undefined;
}

globalThis.__GTKX_CONTAINER_NODE_CACHE__ ??= new WeakMap<BackingInstance, Node>();

const containerNodeCache = globalThis.__GTKX_CONTAINER_NODE_CACHE__;

type PublicInstance = Gtk.Widget | Gtk.Application;
type HostContext = {
    insideTextBuffer?: boolean;
};

type HostConfig = ReactReconciler.HostConfig<
    string,
    Props,
    BackingInstance,
    Node,
    Node,
    never,
    never,
    never,
    PublicInstance,
    HostContext,
    never,
    number,
    -1,
    number
>;

export type ReconcilerInstance = ReactReconciler.Reconciler<BackingInstance, Node, Node, never, never, PublicInstance>;

const getOrCreateContainerNode = (container: BackingInstance): Node => {
    let node = containerNodeCache.get(container);

    if (!node) {
        const runtimeName = typeName(container.__gtype__);
        if (!runtimeName) {
            throw new Error("Cannot resolve runtime GLib type name for container");
        }
        node = createNode(runtimeName, {}, container, container);
        containerNodeCache.set(container, node);
    }

    return node;
};

const withSignalsBlocked = <T>(node: Node, fn: () => T): T => {
    node.signalStore.blockAll();
    try {
        return fn();
    } finally {
        node.signalStore.unblockAll();
    }
};

/**
 * Builds an idempotency guard for {@link HostConfig.detachDeletedInstance}.
 *
 * React's fiber model keeps both `current` and `workInProgress` fibers
 * pointing at the same host instance. When a subtree is unmounted after a
 * commit, `detachFiberAfterEffects` recurses into the alternate fiber, so
 * `detachDeletedInstance` is invoked once per fiber alternate — twice for
 * any node that has survived at least one re-render. Side-effects such as
 * `Gtk.Window.destroy()` must run exactly once; this guard tracks Nodes
 * whose detach has already executed and short-circuits subsequent calls.
 */
const createDetachGuard = (): ((instance: Node) => void) => {
    const detachedNodes = new WeakSet<Node>();
    return (instance: Node) => {
        if (detachedNodes.has(instance)) return;
        detachedNodes.add(instance);
        instance.detachDeletedInstance();
    };
};

type SchedulingConfig = Pick<
    HostConfig,
    | "supportsMutation"
    | "supportsPersistence"
    | "supportsHydration"
    | "supportsMicrotasks"
    | "scheduleMicrotask"
    | "isPrimaryRenderer"
    | "noTimeout"
    | "scheduleTimeout"
    | "cancelTimeout"
    | "getCurrentUpdatePriority"
    | "setCurrentUpdatePriority"
    | "resolveUpdatePriority"
>;

const createSchedulingConfig = (): SchedulingConfig => ({
    supportsMutation: true,
    supportsPersistence: false,
    supportsHydration: false,
    supportsMicrotasks: true,
    scheduleMicrotask: (fn: () => unknown) => queueMicrotask(fn),
    isPrimaryRenderer: true,
    noTimeout: -1,
    scheduleTimeout: (fn, delay) => {
        const timeoutId = setTimeout(fn, delay ?? 0);
        return typeof timeoutId === "number" ? timeoutId : Number(timeoutId);
    },
    cancelTimeout: (id) => {
        clearTimeout(id);
    },
    getCurrentUpdatePriority: () => DiscreteEventPriority,
    setCurrentUpdatePriority: () => {},
    resolveUpdatePriority: () => DiscreteEventPriority,
});

type HostContextConfig = Pick<HostConfig, "getRootHostContext" | "getChildHostContext" | "shouldSetTextContent">;

const createHostContextConfig = (): HostContextConfig => ({
    getRootHostContext: () => ({}),
    getChildHostContext: (parentHostContext, type) => {
        const containerClass = resolveContainerClass(type);
        if ((containerClass && isBuffered(containerClass.prototype)) || type === "TextTag") {
            return { insideTextBuffer: true };
        }
        if (parentHostContext.insideTextBuffer) {
            return {};
        }
        return parentHostContext;
    },
    shouldSetTextContent: () => false,
});

type InstanceConfig = Pick<
    HostConfig,
    "createInstance" | "createTextInstance" | "appendInitialChild" | "finalizeInitialChildren" | "getPublicInstance"
>;

const createInstanceConfig = (): InstanceConfig => ({
    createInstance: (type, props, rootContainer) => createNode(type, props, undefined, rootContainer),
    createTextInstance: (text, rootContainer, hostContext) => {
        const props = hostContext.insideTextBuffer ? { text } : { label: text };
        const type = hostContext.insideTextBuffer ? "TextSegment" : "GtkLabel";
        const node = createNode(type, props, undefined, rootContainer);
        withSignalsBlocked(node, () => node.commitUpdate(null, props));
        return node;
    },
    appendInitialChild: (parent, child) => {
        parent.appendChild(child);
    },
    finalizeInitialChildren: (instance, _type, props) =>
        withSignalsBlocked(instance, () => instance.finalizeInitialChildren(props)),
    getPublicInstance: (instance) => instance.backingInstance as PublicInstance,
});

type MutationConfig = Pick<
    HostConfig,
    | "appendChild"
    | "removeChild"
    | "insertBefore"
    | "appendChildToContainer"
    | "removeChildFromContainer"
    | "insertInContainerBefore"
    | "clearContainer"
>;

const createMutationConfig = (): MutationConfig => ({
    appendChild: (parent, child) => {
        parent.appendChild(child);
    },
    removeChild: (parent, child) => {
        parent.removeChild(child);
    },
    insertBefore: (parent, child, beforeChild) => {
        parent.insertBefore(child, beforeChild);
    },
    removeChildFromContainer: (container, child) => {
        getOrCreateContainerNode(container).removeChild(child);
    },
    appendChildToContainer: (container, child) => {
        getOrCreateContainerNode(container).appendChild(child);
    },
    insertInContainerBefore: (container, child, beforeChild) => {
        getOrCreateContainerNode(container).insertBefore(child, beforeChild);
    },
    clearContainer: () => {},
});

type CommitConfig = Pick<
    HostConfig,
    "commitUpdate" | "commitMount" | "commitTextUpdate" | "prepareForCommit" | "resetAfterCommit"
>;

const createCommitConfig = (): CommitConfig => ({
    commitUpdate: (instance, _type, oldProps, newProps) =>
        withSignalsBlocked(instance, () => instance.commitUpdate(oldProps, newProps)),
    commitMount: (instance) => {
        beginCommit();
        try {
            instance.commitMount?.();
            drainAfterCommit();
        } finally {
            endCommit();
        }
    },
    commitTextUpdate: (textInstance, oldText, newText) => {
        const key = textInstance.typeName === "TextSegment" ? "text" : "label";
        withSignalsBlocked(textInstance, () => textInstance.commitUpdate({ [key]: oldText }, { [key]: newText }));
    },
    prepareForCommit: () => {
        beginCommit();
        freeze();
        return null;
    },
    resetAfterCommit: () => {
        let drainError: unknown = null;
        try {
            drainAfterCommit();
        } catch (error) {
            drainError = error;
        } finally {
            endCommit();
            unfreeze();
        }
        if (drainError !== null) reportReconcilerError(drainError);
    },
});

type NoopConfig = Pick<
    HostConfig,
    | "preparePortalMount"
    | "NotPendingTransition"
    | "HostTransitionContext"
    | "getInstanceFromNode"
    | "beforeActiveInstanceBlur"
    | "afterActiveInstanceBlur"
    | "prepareScopeUpdate"
    | "getInstanceFromScope"
    | "resetFormInstance"
    | "requestPostPaintCallback"
    | "shouldAttemptEagerTransition"
    | "trackSchedulerEvent"
    | "resolveEventType"
    | "resolveEventTimeStamp"
    | "maySuspendCommit"
    | "preloadInstance"
    | "startSuspendingCommit"
    | "suspendInstance"
    | "waitForCommitToBeReady"
>;

const createNoopConfig = (): NoopConfig => ({
    preparePortalMount: () => {},
    NotPendingTransition: null,
    HostTransitionContext: createReconcilerContext(0),
    getInstanceFromNode: () => null,
    beforeActiveInstanceBlur: () => {},
    afterActiveInstanceBlur: () => {},
    prepareScopeUpdate: () => {},
    getInstanceFromScope: () => null,
    resetFormInstance: () => {},
    requestPostPaintCallback: () => {},
    shouldAttemptEagerTransition: () => false,
    trackSchedulerEvent: () => {},
    resolveEventType: () => null,
    resolveEventTimeStamp: () => Date.now(),
    maySuspendCommit: () => false,
    preloadInstance: () => false,
    startSuspendingCommit: () => {},
    suspendInstance: () => {},
    waitForCommitToBeReady: () => null,
});

export function createHostConfig(): HostConfig {
    return {
        ...createSchedulingConfig(),
        ...createHostContextConfig(),
        ...createInstanceConfig(),
        ...createMutationConfig(),
        ...createCommitConfig(),
        ...createNoopConfig(),
        detachDeletedInstance: createDetachGuard(),
    };
}

/**
 * Builds the reconciler `HostTransitionContext`. `React.createContext` and
 * `react-reconciler` ship independent type declarations for the same runtime
 * context object: the public `react` type omits the internal `_currentValue`
 * slots the reconciler mutates, while the reconciler type omits the public
 * `Provider`/`Consumer` shape. The runtime value satisfies both; the
 * `unknown` hop is the single boundary reconciling the two declarations.
 */
function createReconcilerContext(value: number): ReactReconciler.ReactContext<number> {
    const context: unknown = React.createContext<number>(value);
    return context as ReactReconciler.ReactContext<number>;
}
