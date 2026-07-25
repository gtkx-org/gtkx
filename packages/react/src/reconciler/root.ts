import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getInstanceType, typeName } from "@gtkx/runtime";
import { getOrInsert } from "@gtkx/utils";
import { createContext, type ErrorInfo, type ReactNode } from "react";
import ReactReconciler from "react-reconciler";
import {
    ConcurrentRoot,
    DefaultEventPriority,
    DiscreteEventPriority,
    NoEventPriority,
} from "react-reconciler/constants.js";
import { Prop } from "../components/element.js";
import {
    applyAdoptedProps,
    applyElementProps,
    flushBehaviors,
    mountBehaviors,
    unmountBehaviors,
} from "./apply-props.js";
import type { Props } from "./elements.js";
import { createElementNode } from "./instance.js";
import { typeInfoOf } from "./metadata.js";
import "./register.js";
import { attachChild, detachChild } from "./child-routing.js";
import {
    type AnyNode,
    createPropNode,
    createTextNode,
    type Dispatch,
    ELEMENT_KIND,
    type ElementNode,
    type Instance,
    LAZY_KIND,
    lazyTarget,
    makeElementNode,
    type TextNode,
} from "./node.js";
import { isRootElement, type RootElement, rootElement } from "./root-element.js";
import { beginSuppression, disconnectAllHandlers, endSuppression } from "./signals.js";
import { enclosingHost, flushTextHosts, markTextDirty, surgicalTextUpdate, validateContentMix } from "./text.js";

type Container = RootElement | GObject.Object;

const HOST_CONTEXT: Record<string, never> = {};
let currentPriority: number = NoEventPriority;

const containerNodes = new WeakMap<object, ElementNode>();

const attachToContainer = (container: Container, child: AnyNode, before: AnyNode | null): void => {
    if (!isRootElement(container)) attachChild(containerNodeFor(container), child, before);
};

const detachFromContainer = (container: Container, child: AnyNode): void => {
    if (!isRootElement(container)) detachChild(containerNodeFor(container), child);
};

const publicInstanceOf = (instance: Instance): object => {
    if (instance.kind === ELEMENT_KIND) return instance.object;
    if (instance.kind === LAZY_KIND) return instance.adopted ?? instance;
    return instance;
};

const setWidgetVisible = (instance: Instance, visible: boolean): void => {
    if (instance.kind === ELEMENT_KIND && instance.object instanceof Gtk.Widget) instance.object.setVisible(visible);
};

const hostConfig = {
    supportsMutation: true,
    supportsPersistence: false,
    supportsHydration: false,
    isPrimaryRenderer: true,
    noTimeout: -1,
    scheduleTimeout: (fn: (...args: unknown[]) => unknown, delay?: number): ReturnType<typeof setTimeout> =>
        setTimeout(fn, delay),
    cancelTimeout: (id: ReturnType<typeof setTimeout>): void => {
        clearTimeout(id);
    },
    createInstance: (type: string, props: Props): Instance => makeInstance(type, props),
    createTextInstance: (text: string): TextNode => createTextNode(text),
    appendInitialChild: (parent: Instance, child: AnyNode): void => attachChild(parent, child, null),
    finalizeInitialChildren: (instance: Instance, _type: string, props: Props): boolean => {
        if (instance.kind !== ELEMENT_KIND) return false;
        validateContentMix(instance, props);
        return typeInfoOf(instance.typeName).hasMount;
    },
    commitMount: (instance: Instance): void => {
        if (instance.kind === ELEMENT_KIND) mountBehaviors(instance);
    },
    shouldSetTextContent: (): boolean => false,
    getRootHostContext: (): Record<string, never> => HOST_CONTEXT,
    getChildHostContext: (parent: Record<string, never>): Record<string, never> => parent,
    getPublicInstance: (instance: Instance): object => publicInstanceOf(instance),
    prepareForCommit: (): null => {
        beginSuppression();
        return null;
    },
    resetAfterCommit: (): void => {
        flushTextHosts();
        flushBehaviors();
        endSuppression();
    },
    preparePortalMount: (): void => {},
    clearContainer: (): void => {},
    appendChild: (parent: Instance, child: AnyNode): void => attachChild(parent, child, null),
    appendChildToContainer: (container: Container, child: AnyNode): void => attachToContainer(container, child, null),
    insertBefore: (parent: Instance, child: AnyNode, before: AnyNode): void => attachChild(parent, child, before),
    insertInContainerBefore: (container: Container, child: AnyNode, before: AnyNode): void =>
        attachToContainer(container, child, before),
    removeChild: (parent: Instance, child: AnyNode): void => detachChild(parent, child),
    removeChildFromContainer: (container: Container, child: AnyNode): void => detachFromContainer(container, child),
    commitTextUpdate: (textInstance: TextNode, oldText: string, newText: string): void => {
        textInstance.text = newText;
        const host = enclosingHost(textInstance);
        if (host !== null && !surgicalTextUpdate(host, textInstance, oldText, newText)) markTextDirty(host);
    },
    commitUpdate: (instance: Instance, _type: string, prevProps: Props, nextProps: Props): void => {
        if (instance.kind === ELEMENT_KIND) applyElementProps(instance, prevProps, nextProps);
        else if (instance.kind === LAZY_KIND && instance.adopted !== null) {
            applyAdoptedProps(lazyTarget(instance, instance.adopted), prevProps, nextProps);
            instance.props = nextProps;
        }
    },
    hideInstance: (instance: Instance): void => setWidgetVisible(instance, false),
    unhideInstance: (instance: Instance, props: Props): void => setWidgetVisible(instance, props.visible !== false),
    hideTextInstance: (): void => {},
    unhideTextInstance: (): void => {},
    detachDeletedInstance: (instance: Instance): void => {
        if (instance.kind === ELEMENT_KIND) {
            disconnectAllHandlers(instance);
            unmountBehaviors(instance);
        } else if (instance.kind === LAZY_KIND && instance.adopted !== null) {
            disconnectAllHandlers(lazyTarget(instance, instance.adopted));
        }
    },
    getInstanceFromNode: (): null => null,
    beforeActiveInstanceBlur: (): void => {},
    afterActiveInstanceBlur: (): void => {},
    prepareScopeUpdate: (): void => {},
    getInstanceFromScope: (): null => null,
    setCurrentUpdatePriority: (priority: number): void => {
        currentPriority = priority;
    },
    getCurrentUpdatePriority: (): number => currentPriority,
    resolveUpdatePriority: (): number => (currentPriority === NoEventPriority ? DefaultEventPriority : currentPriority),
    resetFormInstance: (): void => {},
    requestPostPaintCallback: (): void => {},
    shouldAttemptEagerTransition: (): boolean => false,
    trackSchedulerEvent: (): void => {},
    resolveEventType: (): null => null,
    resolveEventTimeStamp: (): number => -1,
    maySuspendCommit: (): boolean => false,
    preloadInstance: (): boolean => true,
    startSuspendingCommit: (): void => {},
    suspendInstance: (): void => {},
    waitForCommitToBeReady: (): null => null,
    NotPendingTransition: null,
    HostTransitionContext: createContext(null) as unknown as ReactReconciler.ReactContext<null>,
};

const reconciler = ReactReconciler(hostConfig);

const runDiscrete: Dispatch = (fn) => {
    const previous = currentPriority;
    currentPriority = DiscreteEventPriority;
    try {
        return fn();
    } finally {
        currentPriority = previous;
        reconciler.flushSyncWork();
    }
};

const adoptContainer = (container: GObject.Object): ElementNode => {
    const name = typeName(getInstanceType(container));
    if (name === null) throw new Error("Cannot adopt a container whose GType has no registered name");
    return makeElementNode(name, container, runDiscrete, null);
};

const containerNodeFor = (container: GObject.Object): ElementNode =>
    getOrInsert(containerNodes, container, adoptContainer);

const makeInstance = (type: string, props: Props): Instance => {
    if (type === Prop) return createPropNode(props.propName as string);
    const node = createElementNode(type, props, runDiscrete);
    if (node.kind === ELEMENT_KIND) {
        containerNodes.set(node.object, node);
        applyElementProps(node, {}, props);
    }
    return node;
};

type OpaqueRoot = ReturnType<typeof reconciler.createContainer>;

type RootErrorCallbacks = {
    onUncaughtError?: (error: unknown, info: ErrorInfo) => void;
    onCaughtError?: (error: unknown, info: ErrorInfo) => void;
    onRecoverableError?: (error: unknown, info: ErrorInfo) => void;
};

type ReconcilerRootOptions = RootErrorCallbacks & { containerInfo: Container };

/** A root that mounts an element tree into an explicit container and reports render errors. */
export type ReconcilerRoot = {
    update: (element: ReactNode) => void;
    unmount: (teardown: (root: ReconcilerRoot) => Promise<void>) => Promise<void>;
};

/** The object {@link createRoot} returns: it renders an element tree into a container and can tear it down. */
export type Root = {
    render: (element: ReactNode) => void;
    unmount: () => void;
};

let errorHandler: ((error: unknown) => void) | null = null;
const activeRoots = new Set<OpaqueRoot>();

/**
 * Installs a process-wide handler for errors thrown while rendering or applying an update.
 *
 * @param handler The handler to install.
 * @returns The previously installed handler, or null.
 */
export const setReconcilerErrorHandler = (handler: (error: unknown) => void): ((error: unknown) => void) | null => {
    const previous = errorHandler;
    errorHandler = handler;
    return previous;
};

const openContainer = (containerInfo: Container, callbacks: RootErrorCallbacks): OpaqueRoot => {
    const container = reconciler.createContainer(
        containerInfo,
        ConcurrentRoot,
        null,
        false,
        null,
        "",
        (error, info) => {
            errorHandler?.(error);
            callbacks.onUncaughtError?.(error, info);
        },
        (error, info) => {
            errorHandler?.(error);
            callbacks.onCaughtError?.(error, info);
        },
        (error, info) => {
            callbacks.onRecoverableError?.(error, info);
        },
        () => {},
    );
    activeRoots.add(container);
    return container;
};

const unmountContainer = (container: OpaqueRoot): void => {
    reconciler.updateContainer(null, container, null, null);
    activeRoots.delete(container);
};

/**
 * Creates a root that mounts an element tree into a container, routing render errors to the supplied callbacks.
 *
 * @param options The container to render into and the error callbacks to route failures to.
 * @returns A {@link ReconcilerRoot}.
 */
export const createReconcilerRoot = (options: ReconcilerRootOptions): ReconcilerRoot => {
    const container = openContainer(options.containerInfo, options);
    const root: ReconcilerRoot = {
        update: (element) => {
            reconciler.updateContainer(element, container, null, null);
        },
        unmount: async (teardown) => {
            await teardown(root);
            activeRoots.delete(container);
        },
    };
    return root;
};

/**
 * Creates a render root for a GTKX application.
 *
 * @param container The top-level container to render into; defaults to the shared {@link rootElement}.
 * @returns A {@link Root} exposing render and unmount.
 */
export const createRoot = (container: Container = rootElement): Root => {
    const opaque = openContainer(container, {});
    return {
        render: (element) => {
            reconciler.updateContainer(element, opaque, null, null);
        },
        unmount: () => unmountContainer(opaque),
    };
};

/** Unmounts every active render root and returns `true`. */
export const quit = (): true => {
    for (const container of [...activeRoots]) unmountContainer(container);
    return true;
};

/**
 * Renders children into a container other than the surrounding tree.
 *
 * @param children The element tree to render.
 * @param container The GObject, application, or {@link rootElement} to render into.
 * @param key An optional stable key.
 * @returns A React portal.
 */
export const createPortal = (children: ReactNode, container: Container, key?: string): ReactNode =>
    Object.assign(reconciler.createPortal(children, container, null, key ?? null), { type: "gtkx-portal", props: {} });
