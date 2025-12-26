import { beginBatch, endBatch, getObjectId } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import React from "react";
import type ReactReconciler from "react-reconciler";
import { createNode } from "./factory.js";
import type { Node } from "./node.js";
import { flushAfterCommit } from "./scheduler.js";
import type { Container, ContainerClass, Props } from "./types.js";

let committing = false;

export const isCommitting = (): boolean => committing;

const containerNodeCache = new Map<number, Node>();

type TextInstance = Node;
type SuspenseInstance = never;
type HydratableInstance = never;
type PublicInstance = Gtk.Widget | Gtk.Application;
type HostContext = Record<string, never>;
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
    const id = getObjectId(container.id);
    let node = containerNodeCache.get(id);

    if (!node) {
        const type = (container.constructor as ContainerClass).glibTypeName;
        node = createNode(type, {}, container, container);
        containerNodeCache.set(id, node);
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
        getChildHostContext: (parentHostContext) => parentHostContext,
        shouldSetTextContent: () => false,
        createInstance: (type, props, rootContainer) => {
            return createNode(type, props, undefined, rootContainer);
        },
        createTextInstance: (text, rootContainer) => {
            const props = { label: text };
            const node = createNode("GtkLabel", props, undefined, rootContainer);
            node.updateProps(null, props);
            return node;
        },
        appendInitialChild: (parent, child) => {
            parent.appendChild(child);
        },
        finalizeInitialChildren: (instance, _type, props) => {
            instance.updateProps(null, props);
            return true;
        },
        commitUpdate: (instance, _type, oldProps, newProps) => {
            instance.updateProps(oldProps, newProps);
        },
        commitMount: (instance, _type) => {
            instance.mount();
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
            committing = true;
            beginBatch();
            return null;
        },
        resetAfterCommit: () => {
            endBatch();
            flushAfterCommit();
            committing = false;
        },
        commitTextUpdate: (textInstance, oldText, newText) => {
            textInstance.updateProps({ label: oldText }, { label: newText });
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
        detachDeletedInstance: (instance) => instance.unmount(),
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
