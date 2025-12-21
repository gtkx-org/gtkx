import { beginBatch, endBatch } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import React from "react";
import type ReactReconciler from "react-reconciler";
import { createNode } from "./factory.js";
import type { Node } from "./node.js";
import { flushAfterCommit } from "./scheduler.js";
import type { Container, ContainerClass, Props } from "./types.js";

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

const createNodeWithContainer = (container: Container): Node => {
    const type = (container.constructor as ContainerClass).glibTypeName;
    return createNode(type, {}, container, container);
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
        createInstance: (type, props, rootContainer) => createNode(type, props, undefined, rootContainer),
        createTextInstance: (text) => createNode("GtkLabel", { label: text }),
        appendInitialChild: (parent, child) => parent.appendChild(child),
        finalizeInitialChildren: (instance, _type, props) => {
            instance.updateProps(null, props);
            return true;
        },
        commitUpdate: (instance, _type, oldProps, newProps) => {
            instance.updateProps(oldProps, newProps);
        },
        commitMount: (instance) => {
            instance.mount();
        },
        appendChild: (parent, child) => parent.appendChild(child),
        removeChild: (parent, child) => parent.removeChild(child),
        insertBefore: (parent, child, beforeChild) => parent.insertBefore(child, beforeChild),
        removeChildFromContainer: (container, child) => {
            const parent = createNodeWithContainer(container);
            parent.removeChild(child);
        },
        appendChildToContainer: (container, child) => {
            const parent = createNodeWithContainer(container);
            parent.appendChild(child);
        },
        insertInContainerBefore: (container, child, beforeChild) => {
            const parent = createNodeWithContainer(container);
            parent.insertBefore(child, beforeChild);
        },
        prepareForCommit: () => {
            beginBatch();
            return null;
        },
        resetAfterCommit: () => {
            endBatch();
            flushAfterCommit();
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
