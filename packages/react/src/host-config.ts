import { beginBatch, endBatch } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import React from "react";
import type ReactReconciler from "react-reconciler";
import { createNode, resolveContainerClass } from "./factory.js";
import type { Node } from "./node.js";
import { isBuffered } from "./nodes/internal/predicates.js";
import type { Container, ContainerClass, Props } from "./types.js";

declare global {
    var __GTKX_CONTAINER_NODE_CACHE__: WeakMap<Container, Node> | undefined;
}

if (!globalThis.__GTKX_CONTAINER_NODE_CACHE__) {
    globalThis.__GTKX_CONTAINER_NODE_CACHE__ = new WeakMap<Container, Node>();
}

const containerNodeCache = globalThis.__GTKX_CONTAINER_NODE_CACHE__ as WeakMap<Container, Node>;

type TextInstance = Node;
type SuspenseInstance = never;
type HydratableInstance = never;
type PublicInstance = Gtk.Widget | Gtk.Application;
type HostContext = {
    insideTextBuffer?: boolean;
};
type ChildSet = never;
type TimeoutHandle = number;
type NoTimeout = -1;
type TransitionStatus = number;
type FormInstance = never;

type HostConfig = ReactReconciler.HostConfig<
    string,
    Props,
    Container,
    Node,
    TextInstance,
    SuspenseInstance,
    HydratableInstance,
    FormInstance,
    PublicInstance,
    HostContext,
    ChildSet,
    TimeoutHandle,
    NoTimeout,
    TransitionStatus
>;

export type ReconcilerInstance = ReactReconciler.Reconciler<
    Container,
    Node,
    TextInstance,
    SuspenseInstance,
    FormInstance,
    PublicInstance
>;

const getOrCreateContainerNode = (container: Container): Node => {
    let node = containerNodeCache.get(container);

    if (!node) {
        const type = (container.constructor as ContainerClass).glibTypeName;
        node = createNode(type, {}, container, container);
        containerNodeCache.set(container, node);
    }

    return node;
};

export function createHostConfig(): HostConfig {
    return {
        supportsMutation: true,
        supportsPersistence: false,
        supportsHydration: false,
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
            if (hostContext.insideTextBuffer) {
                const props = { text };
                const node = createNode("TextSegment", props, undefined, rootContainer);
                node.signalStore.blockAll();
                try {
                    node.commitUpdate(null, props);
                } finally {
                    node.signalStore.unblockAll();
                }
                return node;
            }
            const props = { label: text };
            const node = createNode("GtkLabel", props, undefined, rootContainer);
            node.signalStore.blockAll();
            try {
                node.commitUpdate(null, props);
            } finally {
                node.signalStore.unblockAll();
            }
            return node;
        },
        appendInitialChild: (parent, child) => {
            parent.appendInitialChild(child);
        },
        finalizeInitialChildren: (instance, _type, props) => {
            instance.signalStore.blockAll();
            try {
                return instance.finalizeInitialChildren(props);
            } finally {
                instance.signalStore.unblockAll();
            }
        },
        commitUpdate: (instance, _type, oldProps, newProps) => {
            instance.signalStore.blockAll();
            try {
                instance.commitUpdate(oldProps, newProps);
            } finally {
                instance.signalStore.unblockAll();
            }
        },
        commitMount: (instance) => {
            instance.commitMount();
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
            beginBatch();
            return null;
        },
        resetAfterCommit: () => {
            endBatch();
        },
        commitTextUpdate: (textInstance, oldText, newText) => {
            textInstance.signalStore.blockAll();
            try {
                if (textInstance.typeName === "TextSegment") {
                    textInstance.commitUpdate({ text: oldText }, { text: newText });
                } else {
                    textInstance.commitUpdate({ label: oldText }, { label: newText });
                }
            } finally {
                textInstance.signalStore.unblockAll();
            }
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
        detachDeletedInstance: (instance) => instance.detachDeletedInstance(),
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

function createReconcilerContext(value: TransitionStatus): ReactReconciler.ReactContext<TransitionStatus> {
    const context = React.createContext<TransitionStatus>(value);
    return context as unknown as ReactReconciler.ReactContext<TransitionStatus>;
}
