import { beginBatch, endBatch } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import React from "react";
import type ReactReconciler from "react-reconciler";
import { beginCommit, endCommit } from "./batch.js";
import { createNode, type Props, type ROOT_NODE_CONTAINER } from "./factory.js";
import type { Node } from "./node.js";

type Container = Gtk.Widget | typeof ROOT_NODE_CONTAINER;
type TextInstance = Node;
type SuspenseInstance = never;
type HydratableInstance = never;
type PublicInstance = Gtk.Widget;
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

export function createHostConfig(createNodeFromContainer: (container: Container) => Node): HostConfig {
    return {
        supportsMutation: true,
        supportsPersistence: false,
        supportsHydration: false,
        isPrimaryRenderer: true,
        noTimeout: -1,
        getRootHostContext: () => ({}),
        getChildHostContext: (parentHostContext) => parentHostContext,
        shouldSetTextContent: () => false,
        createInstance: (type, props) => createNode(type, props),
        createTextInstance: (text) => createNode("GtkLabel", { label: text }),
        appendInitialChild: (parent, child) => parent.appendChild(child),
        finalizeInitialChildren: () => true,
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
            const parent = createNodeFromContainer(container);
            parent.removeChild(child);
        },
        appendChildToContainer: (container, child) => {
            const parent = createNodeFromContainer(container);
            parent.appendChild(child);
        },
        insertInContainerBefore: (container, child, beforeChild) => {
            const parent = createNodeFromContainer(container);
            parent.insertBefore(child, beforeChild);
        },
        prepareForCommit: () => {
            beginBatch();
            beginCommit();
            return null;
        },
        resetAfterCommit: () => {
            endCommit();
            endBatch();
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
        getPublicInstance: (instance) => instance.getWidget() as PublicInstance,
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
        detachDeletedInstance: () => {},
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
