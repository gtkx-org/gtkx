import type * as Gtk from "@gtkx/ffi/gtk";
import type { Application } from "@gtkx/ffi/gtk";
import React from "react";
import Reconciler from "react-reconciler";
import { createNode, type Props } from "./factory.js";
import type { Node } from "./node.js";

const allInstances = new Set<Node>();

let currentApp: Application | null = null;

export const getCurrentApp = (): Application | null => currentApp;

export const getActiveWindow = (): Gtk.Window | null => currentApp?.getActiveWindow() ?? null;

export const disposeAllInstances = (): void => {
    for (const instance of allInstances) {
        instance.dispose?.();
    }
    allInstances.clear();
};

import { TextNode } from "./nodes/text.js";

/** The React reconciler container type. */
type Container = unknown;
type TextInstance = TextNode;
type SuspenseInstance = never;
type HydratableInstance = never;
type PublicInstance = Node;
type HostContext = Record<string, never>;
type ChildSet = never;
type TimeoutHandle = number;
type NoTimeout = -1;
type TransitionStatus = number;
type FormInstance = never;

/**
 * Custom React reconciler for GTK widgets.
 * Bridges React's component model with GTK's widget system.
 */
export class GtkReconciler {
    private reconciler: Reconciler.Reconciler<
        Container,
        Node,
        TextInstance,
        SuspenseInstance,
        FormInstance,
        PublicInstance
    >;

    /** Creates a new GTK reconciler instance. */
    constructor() {
        this.reconciler = Reconciler(this.createHostConfig());
    }

    /**
     * Sets the current GTK application instance.
     * @param app - The GTK Application instance
     */
    setCurrentApp(app: Application): void {
        currentApp = app;
    }

    /**
     * Gets the underlying React reconciler instance.
     * @returns The react-reconciler instance
     */
    getReconciler(): typeof this.reconciler {
        return this.reconciler;
    }

    private createHostConfig(): Reconciler.HostConfig<
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
    > {
        return {
            supportsMutation: true,
            supportsPersistence: false,
            supportsHydration: false,
            isPrimaryRenderer: true,
            noTimeout: -1 as NoTimeout,

            getRootHostContext: (): HostContext => ({}),
            getChildHostContext: (parentHostContext: HostContext): HostContext => parentHostContext,
            shouldSetTextContent: (): boolean => false,

            createInstance: (type: string, props: Props): Node => {
                const instance = createNode(type, props, currentApp);
                allInstances.add(instance);
                return instance;
            },

            createTextInstance: (text: string): TextInstance => {
                return new TextNode(text);
            },

            appendInitialChild: (parent: Node, child: Node): void => parent.appendChild(child),
            finalizeInitialChildren: (): boolean => true,

            commitUpdate: (instance: Node, _type: string, oldProps: Props, newProps: Props): void => {
                instance.updateProps(oldProps, newProps);
            },

            commitMount: (instance: Node): void => {
                instance.mount();
            },

            appendChild: (parent: Node, child: Node): void => parent.appendChild(child),
            removeChild: (parent: Node, child: Node): void => parent.removeChild(child),
            insertBefore: (parent: Node, child: Node, beforeChild: Node): void =>
                parent.insertBefore(child, beforeChild),

            removeChildFromContainer: (_container: Container, _child: Node): void => {},

            appendChildToContainer: (_container: Container, child: Node): void => {
                child.mount();
            },

            insertInContainerBefore: (_container: Container, child: Node, _beforeChild: Node): void => {
                child.mount();
            },

            prepareForCommit: (): null => null,
            resetAfterCommit: (): void => {},
            commitTextUpdate: (textInstance: TextInstance, _oldText: string, newText: string): void => {
                textInstance.updateText(newText);
            },
            clearContainer: (): void => {},
            preparePortalMount: (): void => {},

            scheduleTimeout: (fn: (...args: unknown[]) => unknown, delay?: number): TimeoutHandle => {
                const timeoutId = setTimeout(fn, delay ?? 0);
                return typeof timeoutId === "number" ? timeoutId : Number(timeoutId);
            },

            cancelTimeout: (id: TimeoutHandle): void => {
                clearTimeout(id);
            },

            getPublicInstance: (instance: Node | TextInstance): PublicInstance => instance as PublicInstance,
            getCurrentUpdatePriority: () => 2,
            setCurrentUpdatePriority: (): void => {},
            resolveUpdatePriority: () => 2,
            NotPendingTransition: null,
            HostTransitionContext: this.createReconcilerContext<TransitionStatus>(0),
            getInstanceFromNode: () => null,
            beforeActiveInstanceBlur: () => {},
            afterActiveInstanceBlur: () => {},
            prepareScopeUpdate: () => {},
            getInstanceFromScope: () => null,
            detachDeletedInstance: (instance: Node): void => {
                instance.dispose?.();
                allInstances.delete(instance);
            },
            resetFormInstance: (): void => {},
            requestPostPaintCallback: (): void => {},
            shouldAttemptEagerTransition: () => false,
            trackSchedulerEvent: (): void => {},
            resolveEventType: (): null | string => null,
            resolveEventTimeStamp: (): number => Date.now(),
            maySuspendCommit: (): boolean => false,
            preloadInstance: (): boolean => false,
            startSuspendingCommit: (): void => {},
            suspendInstance: (): void => {},
            waitForCommitToBeReady: (): null => null,
        };
    }

    private createReconcilerContext<T>(value: T): Reconciler.ReactContext<T> {
        const context = React.createContext<T>(value);
        return context as unknown as Reconciler.ReactContext<T>;
    }
}

const gtkReconciler = new GtkReconciler();

/** The React reconciler instance configured for GTK. */
export const reconciler = gtkReconciler.getReconciler();

/**
 * Sets the current GTK application for the reconciler.
 * @param app - The GTK Application instance
 */
export const setCurrentApp = (app: Application): void => gtkReconciler.setCurrentApp(app);
