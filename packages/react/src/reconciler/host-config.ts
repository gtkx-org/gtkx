import { BUFFER_TEXT_KIND, LABEL_TEXT_KIND } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { freeze, unfreeze } from "@gtkx/native";
import { createContext } from "react";
import type ReactReconciler from "react-reconciler";
import { DiscreteEventPriority } from "react-reconciler/constants.js";
import { isDefaultBlockableType } from "../utils/gtype.js";
import { classHasType } from "../utils/gtype-predicates.js";
import { applyAccessibleProps, isAccessibleProp } from "./accessible.js";
import { applyProps } from "./apply-props.js";
import { beginCommit, endCommit, runCommitFlush } from "./commit-flush.js";
import { attachNode, detachFromParent, detachNode, resyncWrapper } from "./element-map.js";
import {
    createElementInstance,
    createWrapperInstance,
    resolveContainerClass,
    WRAPPER_NODE_ELEMENT,
} from "./instance.js";
import { scheduleLabelTextRebuild } from "./label-text-rebuild.js";
import { getDescriptors } from "./prop-descriptor-table.js";
import { reportReconcilerError } from "./reconciler-error-sink.js";
import { ensureState, type Node, stateOf } from "./state.js";
import { scheduleBufferRebuild } from "./text-buffer-rebuild.js";
import { isBufferContentWrapper, isLabelTextWrapper } from "./text-wrapper.js";
import type { ContainerInfo, Props } from "./types.js";
import { isWrapperElement } from "./wrapper-element.js";

const FIXED_UPDATE_PRIORITY = DiscreteEventPriority;

type PublicInstance = Gtk.Widget | Gtk.Application;

type HostContext = {
    textHost?: "label" | "buffer";
};

type HostConfig = ReactReconciler.HostConfig<
    string,
    Props,
    ContainerInfo,
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

export type ReconcilerInstance = ReactReconciler.Reconciler<ContainerInfo, Node, Node, never, never, PublicInstance>;

const withSignalsBlocked = <T>(instance: Node, fn: () => T): T => {
    const { signalStore } = stateOf(instance);
    signalStore.blockAll();
    try {
        return fn();
    } finally {
        signalStore.unblockAll();
    }
};

const link = (parent: Node, child: Node): void => {
    const { children } = stateOf(parent);
    const index = children.indexOf(child);
    if (index !== -1) children.splice(index, 1);
    children.push(child);
    stateOf(child).parent = parent;
};

const linkBefore = (parent: Node, child: Node, before: Node): void => {
    const { children } = stateOf(parent);
    const existing = children.indexOf(child);
    if (existing !== -1) children.splice(existing, 1);
    const beforeIndex = children.indexOf(before);
    if (beforeIndex === -1) children.push(child);
    else children.splice(beforeIndex, 0, child);
    stateOf(child).parent = parent;
};

const unlink = (parent: Node, child: Node): void => {
    const { children } = stateOf(parent);
    const index = children.indexOf(child);
    if (index !== -1) children.splice(index, 1);
    stateOf(child).parent = null;
};

const isBufferRelated = (instance: Node): boolean =>
    isBufferContentWrapper(instance) || instance instanceof Gtk.TextTag || instance instanceof Gtk.TextBuffer;

const maybeScheduleBufferRebuild = (parent: Node, child: Node): void => {
    if (isBufferRelated(parent) || isBufferRelated(child)) scheduleBufferRebuild(parent);
};

const maybeScheduleLabelTextRebuild = (parent: Node, child: Node): void => {
    if (isLabelTextWrapper(child)) scheduleLabelTextRebuild(parent);
};

const scheduleTextRebuilds = (parent: Node, child: Node): void => {
    maybeScheduleBufferRebuild(parent, child);
    maybeScheduleLabelTextRebuild(parent, child);
};

const appendChild = (parent: Node, child: Node): void => {
    const fresh = stateOf(child).parent === null;
    link(parent, child);
    attachNode(parent, child, null, fresh);
    scheduleTextRebuilds(parent, child);
};

const insertBefore = (parent: Node, child: Node, before: Node): void => {
    linkBefore(parent, child, before);
    attachNode(parent, child, before, false);
    scheduleTextRebuilds(parent, child);
};

const removeChild = (parent: Node, child: Node): void => {
    scheduleTextRebuilds(parent, child);
    unlink(parent, child);
    detachNode(parent, child);
};

const commitInstanceProps = (instance: Node, oldProps: Props | null, newProps: Props): void => {
    const state = stateOf(instance);
    state.props = newProps;
    if (isWrapperElement(instance)) {
        if (isBufferContentWrapper(instance)) scheduleBufferRebuild(instance);
        else resyncWrapper(instance);
        return;
    }
    if (!(instance instanceof GObject.Object)) return;
    const descriptors = getDescriptors(instance);
    if (instance instanceof Gtk.Widget) {
        applyAccessibleProps(instance, oldProps, newProps);
        applyProps(instance, oldProps, newProps, { descriptors, exclude: isAccessibleProp });
    } else {
        applyProps(instance, oldProps, newProps, {
            descriptors,
            defaultBlockable: isDefaultBlockableType(instance.__gtype__),
        });
    }
    if (instance instanceof Gtk.TextTag) scheduleBufferRebuild(instance);
};

const needsDetachOnDelete = (backing: GObject.Object): boolean =>
    !(backing instanceof Gtk.Widget) && !(backing instanceof Gtk.TextBuffer);

const detachInstance = (instance: Node): void => {
    const state = stateOf(instance);
    if (instance instanceof GObject.Object && needsDetachOnDelete(instance) && state.parent) {
        detachFromParent(instance, state.parent);
    }
    state.signalStore.clear(instance);
};

const createDetachGuard = (): ((instance: Node) => void) => {
    const detached = new WeakSet<Node>();
    return (instance: Node) => {
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
    getCurrentUpdatePriority: () => FIXED_UPDATE_PRIORITY,
    setCurrentUpdatePriority: () => {},
    resolveUpdatePriority: () => FIXED_UPDATE_PRIORITY,
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
            ? createWrapperInstance(typeof props["kind"] === "string" ? props["kind"] : "", props, rootContainer)
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
    getPublicInstance: (instance) => instance as PublicInstance,
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
        ensureState(container);
        removeChild(container, child);
    },
    appendChildToContainer: (container, child) => {
        ensureState(container);
        appendChild(container, child);
    },
    insertInContainerBefore: (container, child, beforeChild) => {
        ensureState(container);
        insertBefore(container, child, beforeChild);
    },
    clearContainer: () => {},
});

type CommitConfig = Pick<HostConfig, "commitUpdate" | "commitTextUpdate" | "prepareForCommit" | "resetAfterCommit">;

const guardCommitStep = (step: () => void): void => {
    try {
        step();
    } catch (error) {
        reportReconcilerError(error);
    }
};

const drainCommitQueue = (): void => guardCommitStep(runCommitFlush);

const finalizeCommitAfterLayoutEffects = (): void => {
    drainCommitQueue();
    endCommit();
    guardCommitStep(unfreeze);
};

const createCommitConfig = (): CommitConfig => ({
    commitUpdate: (instance, _type, oldProps, newProps) =>
        withSignalsBlocked(instance, () => commitInstanceProps(instance, oldProps, newProps)),
    commitTextUpdate: (textInstance, _oldText, newText) => {
        stateOf(textInstance).props = { text: newText };
        if (isBufferContentWrapper(textInstance)) scheduleBufferRebuild(textInstance);
        else scheduleLabelTextRebuild(textInstance);
    },
    prepareForCommit: () => {
        freeze();
        beginCommit();
        return null;
    },
    resetAfterCommit: () => {
        drainCommitQueue();
        queueMicrotask(finalizeCommitAfterLayoutEffects);
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
    HostTransitionContext: createContext(0) as unknown as ReactReconciler.ReactContext<number>,
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
