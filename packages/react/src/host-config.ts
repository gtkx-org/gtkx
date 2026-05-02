import { freeze, unfreeze } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import React from "react";
import type ReactReconciler from "react-reconciler";
import { createNode, resolveContainerClass } from "./factory.js";
import type { Node } from "./node.js";
import { isBuffered } from "./nodes/internal/predicates.js";
import type { Container, Props } from "./types.js";

declare global {
    var __GTKX_CONTAINER_NODE_CACHE__: WeakMap<Container, Node> | undefined;
}

globalThis.__GTKX_CONTAINER_NODE_CACHE__ ??= new WeakMap<Container, Node>();

const containerNodeCache = globalThis.__GTKX_CONTAINER_NODE_CACHE__;

type PublicInstance = Gtk.Widget | Gtk.Application;
type HostContext = {
    insideTextBuffer?: boolean;
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

const getOrCreateContainerNode = (container: Container): Node => {
    let node = containerNodeCache.get(container);

    if (!node) {
        node = createNode(container.constructor.glibTypeName, {}, container, container);
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

export function createHostConfig(): HostConfig {
    return {
        supportsMutation: true,
        supportsPersistence: false,
        supportsHydration: false,
        supportsMicrotasks: true,
        scheduleMicrotask: (fn: () => unknown) => queueMicrotask(fn),
        isPrimaryRenderer: true,
        noTimeout: -1,
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
        createInstance: (type, props, rootContainer) => {
            return createNode(type, props, undefined, rootContainer);
        },
        createTextInstance: (text, rootContainer, hostContext) => {
            const props = hostContext.insideTextBuffer ? { text } : { label: text };
            const type = hostContext.insideTextBuffer ? "TextSegment" : "GtkLabel";
            const node = createNode(type, props, undefined, rootContainer);
            withSignalsBlocked(node, () => node.commitUpdate(null, props));
            return node;
        },
        appendInitialChild: (parent, child) => {
            parent.appendInitialChild(child);
        },
        finalizeInitialChildren: (instance, _type, props) =>
            withSignalsBlocked(instance, () => instance.finalizeInitialChildren(props)),
        commitUpdate: (instance, _type, oldProps, newProps) =>
            withSignalsBlocked(instance, () => instance.commitUpdate(oldProps, newProps)),
        commitMount: (instance) => {
            instance.commitMount?.();
        },
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
            const parent = getOrCreateContainerNode(container);
            parent.removeChild(child);
        },
        appendChildToContainer: (container, child) => {
            const parent = getOrCreateContainerNode(container);
            parent.appendChild(child);
        },
        insertInContainerBefore: (container, child, beforeChild) => {
            const parent = getOrCreateContainerNode(container);
            parent.insertBefore(child, beforeChild);
        },
        prepareForCommit: () => {
            freeze();
            return null;
        },
        resetAfterCommit: () => {
            unfreeze();
        },
        commitTextUpdate: (textInstance, oldText, newText) => {
            const key = textInstance.typeName === "TextSegment" ? "text" : "label";
            withSignalsBlocked(textInstance, () => textInstance.commitUpdate({ [key]: oldText }, { [key]: newText }));
        },
        clearContainer: () => {},
        preparePortalMount: () => {},
        scheduleTimeout: (fn, delay) => {
            const timeoutId = setTimeout(fn, delay ?? 0);
            return typeof timeoutId === "number" ? timeoutId : Number(timeoutId);
        },
        cancelTimeout: (id) => {
            clearTimeout(id);
        },
        getPublicInstance: (instance) => instance.container as PublicInstance,
        getCurrentUpdatePriority: () => 2,
        setCurrentUpdatePriority: () => {},
        resolveUpdatePriority: () => 2,
        NotPendingTransition: null,
        HostTransitionContext: createReconcilerContext(0),
        getInstanceFromNode: () => null,
        beforeActiveInstanceBlur: () => {},
        afterActiveInstanceBlur: () => {},
        prepareScopeUpdate: () => {},
        getInstanceFromScope: () => null,
        detachDeletedInstance: (instance) => {
            instance.detachDeletedInstance();
        },
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
    };
}

function createReconcilerContext(value: number): ReactReconciler.ReactContext<number> {
    const context = React.createContext<number>(value);
    return context as unknown as ReactReconciler.ReactContext<number>;
}
