import type { Application } from "@gtkx/ffi/gtk";
import * as Gtk from "@gtkx/ffi/gtk";
import React from "react";
import ReactReconciler from "react-reconciler";
import { createNode, type Props } from "./factory.js";
import type { Node } from "./node.js";
import { WidgetWrapper } from "./nodes/widget.js";

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
    private app: Application | null = null;

    /** Creates a new GTK reconciler instance. */
    constructor() {
        this.instance = ReactReconciler(this.createHostConfig());
    }

    /**
     * Gets the current GTK application instance.
     * @returns The current GTK Application
     */
    getApp(): Application {
        if (!this.app) {
            throw new Error("Tried to get GTK Application before it was set.");
        }

        return this.app;
    }

    /**
     * Sets the current GTK application instance.
     * @param app The GTK Application to set
     */
    setApp(app: Application): void {
        this.app = app;
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
            createInstance: (type, props) => createNode(type, props, this.getApp()),
            createTextInstance: (text) => createNode("Label.Root", { label: text }, this.getApp()),
            appendInitialChild: (parent, child) => parent.appendChild(child),
            finalizeInitialChildren: () => true,
            commitUpdate: (instance, _type, oldProps, newProps) => {
                instance.updateProps(oldProps, newProps);
            },
            commitMount: (instance) => {
                instance.mount(this.getApp());
            },
            appendChild: (parent, child) => parent.appendChild(child),
            removeChild: (parent, child) => parent.removeChild(child),
            insertBefore: (parent, child, beforeChild) => parent.insertBefore(child, beforeChild),
            removeChildFromContainer: (container, child) => {
                if (container instanceof Gtk.Widget) {
                    child.detachFromParent(new WidgetWrapper(container, this.getApp()));
                }
            },
            appendChildToContainer: (container, child) => {
                if (container instanceof Gtk.Widget) {
                    child.attachToParent(new WidgetWrapper(container, this.getApp()));
                }
            },
            insertInContainerBefore: (container, child, _beforeChild) => {
                if (container instanceof Gtk.Widget) {
                    child.attachToParent(new WidgetWrapper(container, this.getApp()));
                }
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
                instance.dispose(this.getApp());
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
}

/** The singleton GTKX React reconciler instance. */
export const reconciler = new Reconciler();
