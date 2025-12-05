import { getCurrentApp } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import React from "react";
import ReactReconciler from "react-reconciler";
import { createNode, type Props } from "./factory.js";
import type { Node } from "./node.js";

type Container = Gtk.Application | Gtk.Widget;
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

type ReconcilerInstance = ReactReconciler.Reconciler<
    Container,
    Node,
    TextInstance,
    SuspenseInstance,
    FormInstance,
    PublicInstance
>;

/**
 * GTKX React reconciler class.
 */
class Reconciler {
    private instance: ReconcilerInstance;

    /** Creates a new GTK reconciler instance. */
    constructor() {
        this.instance = ReactReconciler(this.createHostConfig());
    }

    /**
     * Gets the underlying React reconciler instance.
     * @returns The react-reconciler instance
     */
    getInstance(): ReconcilerInstance {
        return this.instance;
    }

    private createHostConfig(): HostConfig {
        return {
            supportsMutation: true,
            supportsPersistence: false,
            supportsHydration: false,
            isPrimaryRenderer: true,
            noTimeout: -1,
            getRootHostContext: () => ({}),
            getChildHostContext: (parentHostContext) => parentHostContext,
            shouldSetTextContent: () => false,
            createInstance: (type, props) => createNode(type, props, getCurrentApp()),
            createTextInstance: (text) => createNode("Label.Root", { label: text }, getCurrentApp()),
            appendInitialChild: (parent, child) => parent.appendChild(child),
            finalizeInitialChildren: () => true,
            commitUpdate: (instance, _type, oldProps, newProps) => {
                instance.updateProps(oldProps, newProps);
            },
            commitMount: (instance) => {
                instance.mount(getCurrentApp());
            },
            appendChild: (parent, child) => parent.appendChild(child),
            removeChild: (parent, child) => parent.removeChild(child),
            insertBefore: (parent, child, beforeChild) => parent.insertBefore(child, beforeChild),
            removeChildFromContainer: (container, child) => {
                const parent = this.createNodeFromContainer(container);
                parent.removeChild(child);
            },
            appendChildToContainer: (container, child) => {
                const parent = this.createNodeFromContainer(container);
                parent.appendChild(child);
            },
            insertInContainerBefore: (container, child, beforeChild) => {
                const parent = this.createNodeFromContainer(container);
                parent.insertBefore(child, beforeChild);
            },
            prepareForCommit: () => null,
            resetAfterCommit: () => {},
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
            HostTransitionContext: this.createReconcilerContext(0),
            getInstanceFromNode: () => null,
            beforeActiveInstanceBlur: () => {},
            afterActiveInstanceBlur: () => {},
            prepareScopeUpdate: () => {},
            getInstanceFromScope: () => null,
            detachDeletedInstance: (instance) => {
                instance.dispose(getCurrentApp());
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

    private createReconcilerContext(value: TransitionStatus): ReactReconciler.ReactContext<TransitionStatus> {
        const context = React.createContext<TransitionStatus>(value);
        return context as unknown as ReactReconciler.ReactContext<TransitionStatus>;
    }

    private createNodeFromContainer(container: Container): Node {
        if (container instanceof Gtk.Widget) {
            return createNode(container.constructor.name, {}, getCurrentApp(), container);
        }

        return createNode("Application", {}, getCurrentApp(), container as unknown as Gtk.Widget);
    }
}

/** The singleton GTKX React reconciler instance. */
export const reconciler = new Reconciler();
