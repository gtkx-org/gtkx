import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { type AnyClass, getClassType, typeName } from "@gtkx/runtime";
import { createContext } from "react";
import ReactReconciler from "react-reconciler";
import { DefaultEventPriority, DiscreteEventPriority, NoEventPriority } from "react-reconciler/constants.js";
import type { Props } from "./registry.js";
import packageManifest from "../../package.json" with { type: "json" };
import { Prop } from "../components/element.js";
import {
    applyAdoptedProps,
    applyElementProps,
    assertPropsCanChange,
    discardAccessible,
    flushAccessible,
} from "./apply-props.js";
import { attachChild, detachChild } from "./child-routing.js";
import { resolveElementNode } from "./instance.js";
import {
    type AnyNode,
    createElementNode,
    createPropNode,
    createTextNode,
    ELEMENT_KIND,
    type ElementNode,
    type Instance,
    LAZY_KIND,
    lazyTarget,
    TEXT_KIND,
    type TextNode,
} from "./node.js";
import { flushAdoptions, teardownBeforeParent, teardownPlacements } from "./placement.js";
import { isRootElement, type RootElement } from "./root-element.js";
import { disconnectAllHandlers } from "./signals.js";
import { flushStyles, releaseCssClasses, releaseStyle } from "./style.js";
import {
    didUpdateTextSurgically,
    enclosingHost,
    flushTextHosts,
    markTextDirty,
    releaseTextResource,
    validateContentMix,
} from "./text.js";

/** What a tree is rendered into: any GObject, or the {@link RootElement} marker to render at the top level. */
type Container = RootElement | GObject.Object;

type PriorityTracker = {
    get: () => number;
    set: (priority: number) => void;
    withDiscrete: <T>(fn: () => T) => T;
};

const RENDERER_VERSION = packageManifest.version;
const HOST_CONTEXT: Record<string, never> = {};
const containerNodes: WeakMap<GObject.Object, ElementNode> = new WeakMap();
const priority = createPriorityTracker();

const hostConfig = {
    rendererPackageName: "@gtkx/react",
    rendererVersion: RENDERER_VERSION,
    supportsMutation: true,
    supportsPersistence: false,
    supportsHydration: false,
    supportsMicrotasks: true,
    scheduleMicrotask: (fn: () => void): void => {
        queueMicrotask(fn);
    },
    isPrimaryRenderer: true,
    noTimeout: -1,
    scheduleTimeout: (fn: (...args: unknown[]) => unknown, delay?: number): ReturnType<typeof setTimeout> =>
        setTimeout(fn, delay),
    cancelTimeout: (id: ReturnType<typeof setTimeout>): void => {
        clearTimeout(id);
    },
    createInstance: (type: string, props: Props): Instance => createNode(type, props),
    createTextInstance: (text: string): TextNode => createTextNode(text),
    appendInitialChild: (parent: Instance, child: AnyNode): void => {
        attachChild(parent, child, null);
    },
    finalizeInitialChildren: (instance: Instance, _type: string, props: Props): boolean => {
        if (instance.kind === ELEMENT_KIND) {
            validateContentMix(instance, props);
            instance.isMounted = true;
        }

        return false;
    },
    shouldSetTextContent: (): boolean => false,
    getRootHostContext: (): Record<string, never> => HOST_CONTEXT,
    getChildHostContext: (parent: Record<string, never>): Record<string, never> => parent,
    getPublicInstance: (instance: Instance): object => getPublicInstance(instance),
    prepareForCommit: (): null => null,
    resetAfterCommit: (): void => {
        flushTextHosts();
        flushAccessible();
        flushStyles();
        flushAdoptions();
    },
    preparePortalMount: (): void => undefined,
    clearContainer: (): void => undefined,
    appendChild: (parent: Instance, child: AnyNode): void => {
        attachChild(parent, child, null);
    },
    appendChildToContainer: (container: Container, child: AnyNode): void => {
        attachToContainer(container, child, null);
    },
    insertBefore: (parent: Instance, child: AnyNode, before: AnyNode): void => {
        attachChild(parent, child, before);
    },
    insertInContainerBefore: (container: Container, child: AnyNode, before: AnyNode): void => {
        attachToContainer(container, child, before);
    },
    removeChild: (parent: Instance, child: AnyNode): void => {
        prepareSubtreeDetach(child);
        detachChild(parent, child);
        detachSubtree(child);
    },
    removeChildFromContainer: (container: Container, child: AnyNode): void => {
        detachFromContainer(container, child);
    },
    commitTextUpdate: (textInstance: TextNode, oldText: string, newText: string): void => {
        textInstance.text = newText;
        const host = enclosingHost(textInstance);

        if (host !== null && !didUpdateTextSurgically(host, textInstance, oldText, newText)) {
            markTextDirty(host);
        }
    },
    commitUpdate: (instance: Instance, _type: string, prevProps: Props, nextProps: Props): void => {
        updateInstance(instance, prevProps, nextProps);
    },
    hideInstance: (instance: Instance): void => {
        setWidgetVisible(instance, false);
    },
    unhideInstance: (instance: Instance, props: Props): void => {
        setWidgetVisible(instance, props.visible !== false);
    },
    hideTextInstance: (): void => undefined,
    unhideTextInstance: (): void => undefined,
    detachDeletedInstance: (): void => undefined,
    getInstanceFromNode: (): null => null,
    beforeActiveInstanceBlur: (): void => undefined,
    afterActiveInstanceBlur: (): void => undefined,
    prepareScopeUpdate: (): void => undefined,
    getInstanceFromScope: (): null => null,
    setCurrentUpdatePriority: (next: number): void => {
        priority.set(next);
    },
    getCurrentUpdatePriority: (): number => priority.get(),
    resolveUpdatePriority: (): number => (priority.get() === NoEventPriority ? DefaultEventPriority : priority.get()),
    resetFormInstance: (): void => undefined,
    requestPostPaintCallback: (): void => undefined,
    shouldAttemptEagerTransition: (): boolean => false,
    trackSchedulerEvent: (): void => undefined,
    resolveEventType: (): null => null,
    resolveEventTimeStamp: (): number => -1,
    maySuspendCommit: (): boolean => false,
    preloadInstance: (): boolean => true,
    startSuspendingCommit: (): void => undefined,
    suspendInstance: (): void => undefined,
    waitForCommitToBeReady: (): null => null,
    NotPendingTransition: null,
    HostTransitionContext: createContext(null),
};

const reconciler: ReactReconciler.Reconciler<Container, Instance, TextNode, unknown, unknown, object> =
    ReactReconciler(hostConfig);

function createPriorityTracker(): PriorityTracker {
    let current: number = NoEventPriority;

    return {
        get: () => current,
        set: (next) => {
            current = next;
        },
        withDiscrete: (fn) => {
            const previous = current;
            current = DiscreteEventPriority;

            try {
                return fn();
            } finally {
                current = previous;
            }
        },
    };
}

const detachElement = (instance: ElementNode): void => {
    disconnectAllHandlers(instance);
    discardAccessible(instance);
    releaseTextResource(instance);

    const placedChildren = Array.from(instance.placements.values(), (entries) => entries.map((entry) => entry.node));
    teardownPlacements(instance);

    for (const entries of placedChildren) {
        for (const child of entries) {
            detachSubtree(child);
        }
    }

    for (const child of instance.content) {
        detachSubtree(child);
    }

    if (instance.object instanceof Gtk.Widget) {
        releaseCssClasses(instance.object, instance);
        releaseStyle(instance.object);
    }

    containerNodes.delete(instance.object);
};

const detachSubtree = (instance: AnyNode): void => {
    if (instance.kind === TEXT_KIND) {
        return;
    }

    if (instance.kind === ELEMENT_KIND) {
        detachElement(instance);

        return;
    }

    if (instance.kind === LAZY_KIND && instance.adopted !== null) {
        disconnectAllHandlers(lazyTarget(instance, instance.adopted));
    }

    for (const child of instance.children) {
        detachSubtree(child);
    }
};

const prepareElementDetach = (instance: ElementNode): void => {
    for (const entries of instance.placements.values()) {
        for (const entry of entries) {
            prepareSubtreeDetach(entry.node);
        }
    }

    for (const child of instance.content) {
        prepareSubtreeDetach(child);
    }

    teardownBeforeParent(instance, detachSubtree);
};

const prepareSubtreeDetach = (instance: AnyNode): void => {
    if (instance.kind === ELEMENT_KIND) {
        prepareElementDetach(instance);
    } else if (instance.kind !== TEXT_KIND) {
        for (const child of instance.children) {
            prepareSubtreeDetach(child);
        }
    }
};

const updateInstance = (instance: Instance, prev: Props, next: Props): void => {
    if (instance.kind === ELEMENT_KIND) {
        assertPropsCanChange(instance.typeName, prev, next);
        applyElementProps(instance, prev, next);

        return;
    }

    if (instance.kind === LAZY_KIND) {
        assertPropsCanChange(instance.typeName, prev, next);
        instance.props = next;

        if (instance.adopted !== null) {
            applyAdoptedProps(lazyTarget(instance, instance.adopted), prev, next);
        }
    }
};

const attachToContainer = (container: Container, child: AnyNode, before: AnyNode | null): void => {
    if (!isRootElement(container)) {
        attachChild(getOrCreateContainerNode(container), child, before);
    }
};

const detachFromContainer = (container: Container, child: AnyNode): void => {
    prepareSubtreeDetach(child);

    if (!isRootElement(container)) {
        detachChild(getOrCreateContainerNode(container), child);
    }

    detachSubtree(child);
};

const getPublicInstance = (instance: Instance): object => {
    if (instance.kind === ELEMENT_KIND) {
        return instance.object;
    }

    return instance;
};

const setWidgetVisible = (instance: Instance, isVisible: boolean): void => {
    if (instance.kind === ELEMENT_KIND && instance.object instanceof Gtk.Widget) {
        instance.object.setVisible(isVisible);
    }
};

const adoptContainer = (container: GObject.Object): ElementNode => {
    const name = typeName(getClassType(container.constructor as AnyClass));

    if (name === null) {
        throw new Error("Cannot adopt a container whose GType has no registered name");
    }

    const node = createElementNode(name, container, priority.withDiscrete, null);
    node.isMounted = true;

    return node;
};

const getOrCreateContainerNode = (container: GObject.Object): ElementNode =>
    containerNodes.getOrInsertComputed(container, adoptContainer);

const createNode = (type: string, props: Props): Instance => {
    if (type === Prop) {
        return createPropNode(props.propName as string);
    }

    const node = resolveElementNode(type, props, priority.withDiscrete);

    if (node.kind === ELEMENT_KIND) {
        containerNodes.set(node.object, node);
        applyElementProps(node, {}, props);
    }

    return node;
};

export { reconciler, type Container };
