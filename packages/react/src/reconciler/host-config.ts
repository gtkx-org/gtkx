import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getInstanceType, typeName } from "@gtkx/runtime";
import { getOrInsert } from "@gtkx/utils";
import { createContext } from "react";
import ReactReconciler from "react-reconciler";
import { DefaultEventPriority, DiscreteEventPriority, NoEventPriority } from "react-reconciler/constants.js";
import type { Props } from "./registry.js";
import { Prop } from "../components/element.js";
import {
    applyAdoptedProps,
    applyElementProps,
    flushBehaviors,
    mountBehaviors,
    unmountBehaviors,
} from "./apply-props.js";
import { attachChild, detachChild } from "./child-routing.js";
import { resolveElementNode } from "./instance.js";
import { typeInfoOf } from "./metadata.js";
import {
    type AnyNode,
    createElementNode,
    createPropNode,
    createTextNode,
    type Dispatch,
    ELEMENT_KIND,
    type ElementNode,
    type Instance,
    LAZY_KIND,
    lazyTarget,
    type TextNode,
} from "./node.js";
import { isRootElement, type RootElement } from "./root-element.js";
import { beginSuppression, disconnectAllHandlers, endSuppression } from "./signals.js";
import { enclosingHost, flushTextHosts, markTextDirty, surgicalTextUpdate, validateContentMix } from "./text.js";

/** A top-level container an element tree can be mounted into. */
type Container = RootElement | GObject.Object;

const HOST_CONTEXT: Record<string, never> = {};
let currentPriority: number = NoEventPriority;
const containerNodes: WeakMap<object, ElementNode> = new WeakMap();

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
    createInstance: (type: string, props: Props): Instance => createNode(type, props),
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

const reconciler: ReactReconciler.Reconciler<Container, Instance, TextNode, unknown, unknown, object> =
    ReactReconciler(hostConfig);

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

    return createElementNode(name, container, runDiscrete, null);
};

const containerNodeFor = (container: GObject.Object): ElementNode =>
    getOrInsert(containerNodes, container, adoptContainer);

const createNode = (type: string, props: Props): Instance => {
    if (type === Prop) return createPropNode(props.propName as string);

    const node = resolveElementNode(type, props, runDiscrete);

    if (node.kind === ELEMENT_KIND) {
        containerNodes.set(node.object, node);
        applyElementProps(node, {}, props);
    }

    return node;
};

export { reconciler, type Container };
