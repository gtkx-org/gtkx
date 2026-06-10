import * as Gio from "@gtkx/gi/gio";
import { typeName } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { freeze, unfreeze } from "@gtkx/native";
import React from "react";
import type ReactReconciler from "react-reconciler";
import { DiscreteEventPriority } from "react-reconciler/constants.js";
import { beginCommit, endCommit, runCommitFlush } from "./commit-flush.js";
import { attachToParent, detachFromParent, resyncWrapper } from "./element-map.js";
import { classHasType } from "./gtype-predicates.js";
import {
    createElementInstance,
    createRootInstance,
    createWrapperInstance,
    type Instance,
    isWrapperInstance,
    resolveContainerClass,
    WRAPPER_NODE_ELEMENT,
} from "./instance.js";
import { applyAccessibleProps, isAccessibleProp } from "./nodes/internal/accessible.js";
import { applyProps } from "./nodes/internal/apply-props.js";
import { scheduleLabelTextRebuild } from "./nodes/internal/label-text-rebuild.js";
import { scheduleMenuItemResnapshot } from "./nodes/internal/menu-attach.js";
import { getPropDescriptors } from "./nodes/internal/prop-descriptor-table.js";
import { scheduleBufferRebuild } from "./nodes/internal/text-buffer-rebuild.js";
import { BUFFER_TEXT_KIND, LABEL_TEXT_KIND } from "./nodes/internal/text-kinds.js";
import { isBufferContentWrapper, isLabelTextWrapper } from "./nodes/internal/text-wrapper.js";
import { reportReconcilerError } from "./reconciler-error-sink.js";
import type { BackingInstance, ContainerInfo, Props } from "./types.js";

declare global {
    var __GTKX_CONTAINER_NODE_CACHE__: WeakMap<ContainerInfo, Instance> | undefined;
}

globalThis.__GTKX_CONTAINER_NODE_CACHE__ ??= new WeakMap<ContainerInfo, Instance>();

const containerNodeCache = globalThis.__GTKX_CONTAINER_NODE_CACHE__;

type PublicInstance = Gtk.Widget | Gtk.Application;

/**
 * Tracks whether the elements being created sit inside a text-capable host:
 * a `<GtkLabel>` (text children become label text) or a `<GtkTextBuffer>`
 * (text children become buffer content). Text nodes outside both are invalid.
 */
type HostContext = {
    textHost?: "label" | "buffer";
};

type HostConfig = ReactReconciler.HostConfig<
    string,
    Props,
    ContainerInfo,
    Instance,
    Instance,
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

export type ReconcilerInstance = ReactReconciler.Reconciler<
    ContainerInfo,
    Instance,
    Instance,
    never,
    never,
    PublicInstance
>;

const hasGType = (container: ContainerInfo): container is BackingInstance =>
    typeof (container as { __gtype__?: unknown }).__gtype__ === "number";

const getOrCreateContainerNode = (container: ContainerInfo): Instance => {
    let node = containerNodeCache.get(container);

    if (!node) {
        if (!hasGType(container)) {
            node = createRootInstance(container);
        } else {
            const runtimeName = typeName(container.__gtype__);
            if (!runtimeName) {
                throw new Error("Cannot resolve runtime GLib type name for container");
            }
            node = createElementInstance(runtimeName, {}, container, container);
        }
        containerNodeCache.set(container, node);
    }

    return node;
};

const withSignalsBlocked = <T>(instance: Instance, fn: () => T): T => {
    instance.signalStore.blockAll();
    try {
        return fn();
    } finally {
        instance.signalStore.unblockAll();
    }
};

// --- Children management ---

const link = (parent: Instance, child: Instance): void => {
    const index = parent.children.indexOf(child);
    if (index !== -1) parent.children.splice(index, 1);
    parent.children.push(child);
    child.parent = parent;
};

const linkBefore = (parent: Instance, child: Instance, before: Instance): void => {
    const existing = parent.children.indexOf(child);
    if (existing !== -1) parent.children.splice(existing, 1);
    const beforeIndex = parent.children.indexOf(before);
    if (beforeIndex === -1) parent.children.push(child);
    else parent.children.splice(beforeIndex, 0, child);
    child.parent = parent;
};

const unlink = (parent: Instance, child: Instance): void => {
    const index = parent.children.indexOf(child);
    if (index !== -1) parent.children.splice(index, 1);
    child.parent = null;
};

const isBufferRelated = (instance: Instance): boolean =>
    isBufferContentWrapper(instance) ||
    instance.backingInstance instanceof Gtk.TextTag ||
    instance.backingInstance instanceof Gtk.TextBuffer;

const maybeScheduleBufferRebuild = (parent: Instance, child: Instance): void => {
    if (isBufferRelated(parent) || isBufferRelated(child)) scheduleBufferRebuild(parent);
};

const maybeScheduleLabelTextRebuild = (parent: Instance, child: Instance): void => {
    if (isLabelTextWrapper(child)) scheduleLabelTextRebuild(parent);
};

const scheduleTextRebuilds = (parent: Instance, child: Instance): void => {
    maybeScheduleBufferRebuild(parent, child);
    maybeScheduleLabelTextRebuild(parent, child);
};

const appendChild = (parent: Instance, child: Instance): void => {
    const fresh = child.parent === null;
    link(parent, child);
    if (isWrapperInstance(child)) attachToParent(child, parent, null, fresh);
    else if (!isWrapperInstance(parent)) attachToParent(child, parent, null, fresh);
    if (isWrapperInstance(parent)) resyncWrapper(parent);
    scheduleTextRebuilds(parent, child);
};

/**
 * The backing instance an ordered insert should position before: the sibling's
 * own backing GObject, or — when the sibling is a metadata wrapper that places a
 * widget directly into the same parent (a transparent wrapper) — that widget,
 * so the new child lands before it rather than appending.
 */
const anchorBacking = (before: Instance): BackingInstance | null => {
    if (before.backingInstance) return before.backingInstance;
    for (const grandchild of before.children) {
        if (grandchild.backingInstance) return grandchild.backingInstance;
    }
    return null;
};

const insertBefore = (parent: Instance, child: Instance, before: Instance): void => {
    linkBefore(parent, child, before);
    if (isWrapperInstance(child)) attachToParent(child, parent);
    else if (!isWrapperInstance(parent)) attachToParent(child, parent, anchorBacking(before));
    if (isWrapperInstance(parent)) resyncWrapper(parent);
    scheduleTextRebuilds(parent, child);
};

const removeChild = (parent: Instance, child: Instance): void => {
    scheduleTextRebuilds(parent, child);
    if (isWrapperInstance(child) || !isWrapperInstance(parent)) detachFromParent(child, parent);
    unlink(parent, child);
    if (isWrapperInstance(parent)) resyncWrapper(parent);
};

// --- Prop commit ---

const commitInstanceProps = (instance: Instance, oldProps: Props | null, newProps: Props): void => {
    instance.props = newProps;
    if (isWrapperInstance(instance)) {
        if (isBufferContentWrapper(instance)) scheduleBufferRebuild(instance);
        else resyncWrapper(instance);
        return;
    }
    const container = instance.backingInstance;
    if (container instanceof Gio.MenuItem) {
        scheduleMenuItemResnapshot(instance);
        return;
    }
    const table = getPropDescriptors(instance);
    if (container instanceof Gtk.Widget) {
        applyAccessibleProps(container, oldProps, newProps);
        applyProps(instance, oldProps, newProps, { table, exclude: isAccessibleProp });
    } else {
        applyProps(instance, oldProps, newProps, { table, defaultBlockable: container instanceof Gtk.TextBuffer });
    }
    if (container instanceof Gtk.TextTag) scheduleBufferRebuild(instance);
};

// --- Instance teardown ---

/**
 * Whether a deleted instance must actively detach from its parent. Widgets are
 * detached by their own removal path, and a text buffer must not be: a deleted
 * subtree's view releases its buffer during its own teardown, and the detach
 * guard's `getBuffer()` would lazily create a fresh buffer on the disposed
 * view.
 */
const needsDetachOnDelete = (backing: BackingInstance): boolean =>
    !(backing instanceof Gtk.Widget) && !(backing instanceof Gtk.TextBuffer);

const detachInstance = (instance: Instance): void => {
    if (instance.backingInstance && needsDetachOnDelete(instance.backingInstance) && instance.parent) {
        detachFromParent(instance, instance.parent);
    }
    instance.signalStore.clear(instance);
};

/**
 * Builds an idempotency guard for {@link HostConfig.detachDeletedInstance}.
 *
 * React's fiber model keeps both `current` and `workInProgress` fibers pointing
 * at the same host instance, so `detachDeletedInstance` is invoked once per
 * fiber alternate. Side-effects such as `Gtk.Window.destroy()` must run exactly
 * once; this guard short-circuits subsequent calls.
 */
const createDetachGuard = (): ((instance: Instance) => void) => {
    const detached = new WeakSet<Instance>();
    return (instance: Instance) => {
        if (detached.has(instance)) return;
        detached.add(instance);
        detachInstance(instance);
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

const EMPTY_CONTEXT: HostContext = {};
const LABEL_CONTEXT: HostContext = { textHost: "label" };
const BUFFER_CONTEXT: HostContext = { textHost: "buffer" };

type TextHostKind = "label" | "buffer" | "tag" | null;

const textHostKinds = new Map<string, TextHostKind>();

const resolveTextHostKind = (type: string): TextHostKind => {
    const cached = textHostKinds.get(type);
    if (cached !== undefined) return cached;
    const containerClass = resolveContainerClass(type);
    let kind: TextHostKind = null;
    if (classHasType(containerClass, "GtkLabel")) kind = "label";
    else if (classHasType(containerClass, "GtkTextBuffer")) kind = "buffer";
    else if (classHasType(containerClass, "GtkTextTag")) kind = "tag";
    textHostKinds.set(type, kind);
    return kind;
};

const createHostContextConfig = (): HostContextConfig => ({
    getRootHostContext: () => EMPTY_CONTEXT,
    getChildHostContext: (parentHostContext, type) => {
        const kind = resolveTextHostKind(type);
        if (kind === "label") return LABEL_CONTEXT;
        if (kind === "buffer") return BUFFER_CONTEXT;
        if (kind === "tag" && parentHostContext.textHost === "buffer") return parentHostContext;
        return parentHostContext.textHost === undefined ? parentHostContext : EMPTY_CONTEXT;
    },
    shouldSetTextContent: () => false,
});

type InstanceConfig = Pick<
    HostConfig,
    "createInstance" | "createTextInstance" | "appendInitialChild" | "finalizeInitialChildren" | "getPublicInstance"
>;

const createInstanceConfig = (): InstanceConfig => ({
    createInstance: (type, props, rootContainer) =>
        type === WRAPPER_NODE_ELEMENT
            ? createWrapperInstance(typeof props.kind === "string" ? props.kind : "", props, rootContainer)
            : createElementInstance(type, props, rootContainer),
    createTextInstance: (text, rootContainer, hostContext) => {
        if (hostContext.textHost === "buffer") {
            return createWrapperInstance(BUFFER_TEXT_KIND, { text }, rootContainer);
        }
        if (hostContext.textHost === "label") {
            return createWrapperInstance(LABEL_TEXT_KIND, { text }, rootContainer);
        }
        throw new Error(
            `Text strings must be rendered within a <GtkLabel> or <GtkTextBuffer> element; received ${JSON.stringify(text)}`,
        );
    },
    appendInitialChild: (parent, child) => {
        appendChild(parent, child);
    },
    finalizeInitialChildren: (instance, _type, props) => {
        withSignalsBlocked(instance, () => commitInstanceProps(instance, null, props));
        return false;
    },
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
        appendChild(parent, child);
    },
    removeChild: (parent, child) => {
        removeChild(parent, child);
    },
    insertBefore: (parent, child, beforeChild) => {
        insertBefore(parent, child, beforeChild);
    },
    removeChildFromContainer: (container, child) => {
        removeChild(getOrCreateContainerNode(container), child);
    },
    appendChildToContainer: (container, child) => {
        appendChild(getOrCreateContainerNode(container), child);
    },
    insertInContainerBefore: (container, child, beforeChild) => {
        insertBefore(getOrCreateContainerNode(container), child, beforeChild);
    },
    clearContainer: () => {},
});

type CommitConfig = Pick<HostConfig, "commitUpdate" | "commitTextUpdate" | "prepareForCommit" | "resetAfterCommit">;

const createCommitConfig = (): CommitConfig => ({
    commitUpdate: (instance, _type, oldProps, newProps) =>
        withSignalsBlocked(instance, () => commitInstanceProps(instance, oldProps, newProps)),
    commitTextUpdate: (textInstance, _oldText, newText) => {
        textInstance.props = { text: newText };
        if (isBufferContentWrapper(textInstance)) scheduleBufferRebuild(textInstance);
        else scheduleLabelTextRebuild(textInstance);
    },
    prepareForCommit: () => {
        beginCommit();
        freeze();
        return null;
    },
    resetAfterCommit: () => {
        let drainError: unknown = null;
        try {
            runCommitFlush();
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
