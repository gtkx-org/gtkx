import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getOrInsert, remove } from "@gtkx/utils";
import { type Context, createContext } from "react";
import type ReactReconciler from "react-reconciler";
import { DiscreteEventPriority } from "react-reconciler/constants.js";
import { hasTypeInChain } from "../utils/type-hierarchy.js";
import { applyAccessibleProps, isAccessibleProp } from "./accessible-props.js";
import { applyProps } from "./apply-props.js";
import { runCommitFlush } from "./commit-flush.js";
import { attachNode, detachFromParent, detachNode, resyncWrapperNode } from "./dispatch.js";
import { applyElementProps, reapplyLazyProps } from "./element-prop-appliers.js";
import { isAppliedProp } from "./element-props.js";
import { createElementInstance, createWrapperInstance } from "./instance.js";
import { scheduleLabelTextRebuild } from "./label-text-rebuild.js";
import { catchReconcilerError } from "./reconciler-error-handler.js";
import { ensureSignalStore } from "./signal-store.js";
import { ensureState, type Node, stateOf } from "./state.js";
import { scheduleTextBufferSync } from "./text-buffer-content-manager.js";
import { isBufferContentNode, isLabelTextNode } from "./text-node-predicates.js";
import type { Container, Props } from "./types.js";
import { hideNode, reassertHidden, setTextNodeHidden, unhideNode } from "./visibility.js";
import { isWrapperKind, TEXT_KIND, WRAPPER_ELEMENT } from "./wrapper-kinds.js";
import { isWrapperNode } from "./wrapper-node.js";

const FIXED_UPDATE_PRIORITY = DiscreteEventPriority;

type PublicInstance = GObject.Object;

type HostContext = {
    textHost?: "label" | "buffer";
};

type HostConfig = ReactReconciler.HostConfig<
    string,
    Props,
    Container,
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

export type ReconcilerInstance = ReactReconciler.Reconciler<Container, Node, Node, never, never, PublicInstance>;

const link = (parent: Node, child: Node, before?: Node): void => {
    const { children } = stateOf(parent);
    remove(children, child);
    const index = before === undefined ? -1 : children.indexOf(before);
    if (index === -1) children.push(child);
    else children.splice(index, 0, child);
    stateOf(child).parent = parent;
};

const unlink = (parent: Node, child: Node): void => {
    remove(stateOf(parent).children, child);
    stateOf(child).parent = null;
};

const isBufferRelated = (instance: Node): boolean =>
    isBufferContentNode(instance) || instance instanceof Gtk.TextBuffer;

const scheduleTextRebuilds = (parent: Node, child: Node): void => {
    if (isBufferRelated(parent) || isBufferRelated(child)) {
        scheduleTextBufferSync(parent, isBufferContentNode(child) ? child : parent);
    }
    if (isLabelTextNode(child)) scheduleLabelTextRebuild(parent);
};

const reapplyParentLazy = (parent: Node): void => {
    if (parent instanceof GObject.Object) reapplyLazyProps(parent, stateOf(parent).props);
};

const appendChild = (parent: Node, child: Node): void => {
    const fresh = stateOf(child).parent === null;
    link(parent, child);
    attachNode(parent, child, null, fresh);
    scheduleTextRebuilds(parent, child);
    reapplyParentLazy(parent);
};

const insertBefore = (parent: Node, child: Node, before: Node): void => {
    link(parent, child, before);
    attachNode(parent, child, before, false);
    scheduleTextRebuilds(parent, child);
    reapplyParentLazy(parent);
};

const removeChild = (parent: Node, child: Node): void => {
    scheduleTextRebuilds(parent, child);
    unlink(parent, child);
    detachNode(parent, child);
};

const commitInstanceProps = (instance: Node, oldProps: Props | null, newProps: Props): void => {
    const state = stateOf(instance);
    state.props = newProps;
    if (isWrapperNode(instance)) {
        resyncWrapperNode(instance);
        reassertHidden(instance);
        return;
    }
    if (!(instance instanceof GObject.Object)) return;
    const excludeApplied = (name: string): boolean => isAppliedProp(instance.__type__, name);
    const applyGenericAndSignals = (): void => {
        if (instance instanceof Gtk.Accessible) {
            applyAccessibleProps(instance, oldProps, newProps);
            applyProps(instance, oldProps, newProps, {
                exclude: (name) => isAccessibleProp(name) || excludeApplied(name),
            });
        } else {
            applyProps(instance, oldProps, newProps, { exclude: excludeApplied });
        }
    };
    if (oldProps === null) {
        applyElementProps(instance, oldProps, newProps);
        applyGenericAndSignals();
    } else {
        applyGenericAndSignals();
        applyElementProps(instance, oldProps, newProps);
    }
    reassertHidden(instance);
};

const needsDetachOnDelete = (wrapper: GObject.Object): boolean =>
    !(wrapper instanceof Gtk.Widget) && !(wrapper instanceof Gtk.TextBuffer);

const detachInstance = (instance: Node): void => {
    const state = stateOf(instance);
    if (instance instanceof GObject.Object && needsDetachOnDelete(instance) && state.parent) {
        detachFromParent(instance, state.parent);
    }
    if (instance instanceof GObject.Object) state.signalStore.clear(instance);
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

const resolveTextHostKind = (type: string): TextHostKind =>
    getOrInsert(textHostKinds, type, () => {
        const gtype = GObject.typeFromName(type);
        if (hasTypeInChain(gtype, "GtkLabel")) return "label";
        if (hasTypeInChain(gtype, "GtkTextBuffer")) return "buffer";
        if (hasTypeInChain(gtype, "GtkTextTag")) return "tag";
        return null;
    });

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
    createInstance: (type, props, rootContainer) => {
        if (type !== WRAPPER_ELEMENT) {
            return createElementInstance(type, props, rootContainer);
        }
        const kind = props.kind;
        if (!isWrapperKind(kind)) {
            throw new Error(`Wrapper node element has an invalid kind: ${JSON.stringify(kind)}`);
        }
        return createWrapperInstance(kind, props, rootContainer);
    },
    createTextInstance: (text, rootContainer, hostContext) => {
        if (hostContext.textHost === undefined) {
            throw new Error(
                `Text strings must be rendered within a <GtkLabel> or <GtkTextBuffer> element; received ${JSON.stringify(text)}`,
            );
        }
        return createWrapperInstance(TEXT_KIND, { text }, rootContainer);
    },
    appendInitialChild: (parent, child) => {
        appendChild(parent, child);
    },
    finalizeInitialChildren: (instance, _type, props) => {
        commitInstanceProps(instance, null, props);
        return false;
    },
    getPublicInstance: (instance) => {
        const adopted = stateOf(instance).adoptedInstance;
        return (adopted ?? instance) as PublicInstance;
    },
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
    | "hideInstance"
    | "unhideInstance"
    | "hideTextInstance"
    | "unhideTextInstance"
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
    hideInstance: (instance) => {
        hideNode(instance);
    },
    unhideInstance: (instance) => {
        unhideNode(instance);
    },
    hideTextInstance: (textInstance) => {
        setTextNodeHidden(textInstance, true);
    },
    unhideTextInstance: (textInstance) => {
        setTextNodeHidden(textInstance, false);
    },
});

type CommitConfig = Pick<HostConfig, "commitUpdate" | "commitTextUpdate" | "prepareForCommit" | "resetAfterCommit">;

const drainCommitQueue = (): void => catchReconcilerError(runCommitFlush);

const finalizeCommitAfterLayoutEffects = (container: Container): void => {
    drainCommitQueue();
    ensureSignalStore(container).unblock();
};

const createCommitConfig = (): CommitConfig => ({
    commitUpdate: (instance, _type, oldProps, newProps) => commitInstanceProps(instance, oldProps, newProps),
    commitTextUpdate: (textInstance, _oldText, newText) => {
        stateOf(textInstance).props = { text: newText };
        if (isBufferContentNode(textInstance)) scheduleTextBufferSync(textInstance);
        else scheduleLabelTextRebuild(textInstance);
    },
    prepareForCommit: (container) => {
        ensureSignalStore(container).block();
        return null;
    },
    resetAfterCommit: (container) => {
        drainCommitQueue();
        queueMicrotask(() => finalizeCommitAfterLayoutEffects(container));
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
    HostTransitionContext: createContext(0) as Context<number> & ReactReconciler.ReactContext<number>,
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
