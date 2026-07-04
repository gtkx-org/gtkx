import { BUFFER_TEXT_KIND, isRelationshipKind, LABEL_TEXT_KIND, RELATIONSHIP_NODE_ELEMENT } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { freeze, unfreeze } from "@gtkx/native";
import { type Context, createContext } from "react";
import type ReactReconciler from "react-reconciler";
import { DiscreteEventPriority } from "react-reconciler/constants.js";
import { isDefaultBlockableType, typeChainIncludes } from "../utils/gtype.js";
import { applyAccessibleProps, isAccessibleProp } from "./accessible.js";
import { applyProps } from "./apply-props.js";
import { beginCommit, endCommit, runCommitFlush } from "./commit-flush.js";
import { attachNode, detachFromParent, detachNode, resyncRelationshipNode } from "./element-map.js";
import { createElementInstance, createRelationshipInstance } from "./instance.js";
import { scheduleLabelTextRebuild } from "./label-text-rebuild.js";
import { reportReconcilerError } from "./reconciler-error-handler.js";
import { isRelationshipNode } from "./relationship-node.js";
import { isRuleManagedProp, RULE_CONTEXT, resolveSetPropsRuleSet, ruleNodeOf } from "./rule-registry.js";
import { ensureState, type Node, stateOf } from "./state.js";
import { scheduleBufferRebuild } from "./text-buffer-rebuild.js";
import { isBufferContentNode, isLabelTextNode } from "./text-node.js";
import type { Container, Props } from "./types.js";

const FIXED_UPDATE_PRIORITY = DiscreteEventPriority;

type PublicInstance = Gtk.Widget | Gtk.Application;

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
    isBufferContentNode(instance) || instance instanceof Gtk.TextTag || instance instanceof Gtk.TextBuffer;

const maybeScheduleBufferRebuild = (parent: Node, child: Node): void => {
    if (isBufferRelated(parent) || isBufferRelated(child)) scheduleBufferRebuild(parent);
};

const maybeScheduleLabelTextRebuild = (parent: Node, child: Node): void => {
    if (isLabelTextNode(child)) scheduleLabelTextRebuild(parent);
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
    if (isRelationshipNode(instance)) {
        if (isBufferContentNode(instance)) scheduleBufferRebuild(instance);
        else resyncRelationshipNode(instance);
        return;
    }
    if (!(instance instanceof GObject.Object)) return;
    const excludeRuleManaged = (name: string): boolean => isRuleManagedProp(instance, name);
    if (instance instanceof Gtk.Accessible) {
        applyAccessibleProps(instance, oldProps, newProps);
        applyProps(instance, oldProps, newProps, {
            exclude: (name) => isAccessibleProp(name) || excludeRuleManaged(name),
        });
    } else {
        applyProps(instance, oldProps, newProps, {
            exclude: excludeRuleManaged,
            defaultBlockable: isDefaultBlockableType(instance.__type__),
        });
    }
    const ruleSet = resolveSetPropsRuleSet(instance.__type__);
    if (ruleSet?.setProps) {
        const node = ruleNodeOf(instance);
        if (node) ruleSet.setProps(node, newProps, oldProps, RULE_CONTEXT);
    }
    if (instance instanceof Gtk.TextTag) scheduleBufferRebuild(instance);
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

const resolveTextHostKind = (type: string): TextHostKind => {
    const cached = textHostKinds.get(type);
    if (cached !== undefined) return cached;
    const gtype = GObject.typeFromName(type);
    let kind: TextHostKind = null;
    if (typeChainIncludes(gtype, "GtkLabel")) kind = "label";
    else if (typeChainIncludes(gtype, "GtkTextBuffer")) kind = "buffer";
    else if (typeChainIncludes(gtype, "GtkTextTag")) kind = "tag";
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
    createInstance: (type, props, rootContainer) => {
        if (type !== RELATIONSHIP_NODE_ELEMENT) {
            return createElementInstance(type, props, rootContainer);
        }
        const kind = props.kind;
        if (!isRelationshipKind(kind)) {
            throw new Error(`Relationship node element has an invalid kind: ${JSON.stringify(kind)}`);
        }
        return createRelationshipInstance(kind, props, rootContainer);
    },
    createTextInstance: (text, rootContainer, hostContext) => {
        if (hostContext.textHost === "buffer") {
            return createRelationshipInstance(BUFFER_TEXT_KIND, { text }, rootContainer);
        }
        if (hostContext.textHost === "label") {
            return createRelationshipInstance(LABEL_TEXT_KIND, { text }, rootContainer);
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

const catchErrors = (fn: () => void): void => {
    try {
        fn();
    } catch (error) {
        reportReconcilerError(error);
    }
};

const drainCommitQueue = (): void => catchErrors(runCommitFlush);

const finalizeCommitAfterLayoutEffects = (): void => {
    drainCommitQueue();
    endCommit();
    catchErrors(unfreeze);
};

const createCommitConfig = (): CommitConfig => ({
    commitUpdate: (instance, _type, oldProps, newProps) =>
        withSignalsBlocked(instance, () => commitInstanceProps(instance, oldProps, newProps)),
    commitTextUpdate: (textInstance, _oldText, newText) => {
        stateOf(textInstance).props = { text: newText };
        if (isBufferContentNode(textInstance)) scheduleBufferRebuild(textInstance);
        else scheduleLabelTextRebuild(textInstance);
    },
    prepareForCommit: () => {
        catchErrors(freeze);
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
