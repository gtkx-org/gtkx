import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { type AnyClass, getClassType, typeName } from "@gtkx/runtime";
import { getOrInsert } from "@gtkx/utils";
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
    flushAccessible,
    flushBehaviors,
    mountElementProps,
    prepareElementProps,
    teardownBehaviors,
    updateElementProps,
} from "./apply-props.js";
import { attachChild, detachChild } from "./child-routing.js";
import { beginCommit, finishCommit } from "./commit-errors.js";
import { resolveElementNode } from "./instance.js";
import { publishLazyPublicInstance } from "./lazy-public-instance.js";
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
import { isRootElement, type RootElement } from "./root-element.js";
import { applyWrite, disconnectAllHandlers } from "./signals.js";
import { releaseStyle } from "./style.js";
import {
    didUpdateTextSurgically,
    enclosingHost,
    flushTextHost,
    flushTextHosts,
    forgetTextHost,
    markTextDirty,
    validateContentMix,
} from "./text.js";

type ContainerTarget = RootElement | GObject.Object;
type Container = { target: ContainerTarget; reportError: (error: unknown) => void };
type Ownership = { owner: Container; managedCount: number; isContainer: boolean };

type PriorityTracker = {
    get: () => number;
    set: (priority: number) => void;
    withDiscrete: <T>(fn: () => T) => T;
};

const RENDERER_VERSION = packageManifest.version;
const HOST_CONTEXT: Record<string, never> = {};
const containerNodes: WeakMap<object, ElementNode> = new WeakMap();
const portalContainers: WeakMap<object, Container> = new WeakMap();
const ownership: WeakMap<object, Ownership> = new WeakMap();
const commitOwner: { current: Container | null } = { current: null };
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
        }

        return false;
    },
    commitMount: (): void => undefined,
    shouldSetTextContent: (): boolean => false,
    getRootHostContext: (): Record<string, never> => HOST_CONTEXT,
    getChildHostContext: (parent: Record<string, never>): Record<string, never> => parent,
    getPublicInstance: (instance: Instance): object | null => getPublicInstance(instance),
    prepareForCommit: (container: Container): null => {
        commitOwner.current = container;
        beginCommit(container.reportError);

        return null;
    },
    resetAfterCommit: (): void => {
        try {
            finishCommit(flushCommittedEffects);
        } finally {
            commitOwner.current = null;
        }
    },
    preparePortalMount: (): void => undefined,
    clearContainer: (): void => undefined,
    appendChild: (parent: Instance, child: AnyNode): void => {
        prepareCommittedTree(child);
        attachChild(parent, child, null);
        mountCommittedTree(child);
    },
    appendChildToContainer: (container: Container, child: AnyNode): void => {
        prepareCommittedTree(child);
        attachToContainer(container, child, null);
        mountCommittedTree(child);
    },
    insertBefore: (parent: Instance, child: AnyNode, before: AnyNode): void => {
        prepareCommittedTree(child);
        attachChild(parent, child, before);
        mountCommittedTree(child);
    },
    insertInContainerBefore: (container: Container, child: AnyNode, before: AnyNode): void => {
        prepareCommittedTree(child);
        attachToContainer(container, child, before);
        mountCommittedTree(child);
    },
    removeChild: (parent: Instance, child: AnyNode): void => {
        detachChild(parent, child);
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
    detachDeletedInstance: (instance: Instance): void => {
        if (instance.kind === ELEMENT_KIND) {
            detachElement(instance);
        } else if (instance.kind === LAZY_KIND && instance.adopted !== null) {
            disconnectAllHandlers(lazyTarget(instance, instance.adopted));
            instance.isMounted = false;
        }
    },
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

const reconciler: ReactReconciler.Reconciler<Container, Instance, TextNode, unknown, unknown, object | null> =
    ReactReconciler(hostConfig);

const createHostContainer = (target: ContainerTarget, reportError: (error: unknown) => void): Container => ({
    target,
    reportError,
});

const getPortalContainer = (target: ContainerTarget, reportError: (error: unknown) => void): Container =>
    getOrInsert(portalContainers, target, () => createHostContainer(target, reportError));

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

function mountPlacedChildren(node: ElementNode, visited: Set<AnyNode>): void {
    for (const entries of node.placements.values()) {
        for (const entry of entries) {
            mountCommittedTree(entry.node, visited);
        }
    }
}

function mountContentChildren(node: ElementNode, visited: Set<AnyNode>): void {
    for (const child of node.content) {
        mountCommittedTree(child, visited);
    }
}

function mountElementTree(node: ElementNode, visited: Set<AnyNode>): void {
    mountPlacedChildren(node, visited);
    mountContentChildren(node, visited);

    if (!node.isMounted) {
        node.reportError = claimManagedObject(node.object).reportError;
        flushTextHost(node);
        mountElementProps(node);
    }
}

function prepareElementTree(node: ElementNode, visited: Set<AnyNode>): void {
    prepareElementProps(node);
    preparePlacedChildren(node, visited);
    prepareContentChildren(node, visited);
}

function preparePlacedChildren(node: ElementNode, visited: Set<AnyNode>): void {
    for (const entries of node.placements.values()) {
        for (const entry of entries) {
            prepareCommittedTree(entry.node, visited);
        }
    }
}

function prepareContentChildren(node: ElementNode, visited: Set<AnyNode>): void {
    for (const child of node.content) {
        prepareCommittedTree(child, visited);
    }
}

function prepareLazyNode(node: Extract<AnyNode, { kind: typeof LAZY_KIND }>, visited: Set<AnyNode>): void {
    prepareChildren(node.children, visited);

    if (!node.isMounted && node.adopted !== null) {
        applyAdoptedProps(lazyTarget(node, node.adopted), {}, node.props);
        node.isMounted = true;
        publishLazyPublicInstance(node.props, node.adopted);
    }
}

function prepareChildren(children: Iterable<AnyNode>, visited: Set<AnyNode>): void {
    for (const child of children) {
        prepareCommittedTree(child, visited);
    }
}

function prepareCommittedTree(node: AnyNode, visited: Set<AnyNode> = new Set()): void {
    if (visited.has(node) || node.kind === TEXT_KIND) {
        return;
    }

    visited.add(node);

    if (node.kind === ELEMENT_KIND) {
        prepareElementTree(node, visited);

        return;
    }

    if (node.kind === LAZY_KIND) {
        prepareLazyNode(node, visited);

        return;
    }

    prepareChildren(node.children, visited);
}

function mountCommittedTree(node: AnyNode, visited: Set<AnyNode> = new Set()): void {
    if (visited.has(node) || node.kind === TEXT_KIND) {
        return;
    }

    visited.add(node);

    if (node.kind === ELEMENT_KIND) {
        mountElementTree(node, visited);

        return;
    }

    for (const child of node.children) {
        mountCommittedTree(child, visited);
    }
}

function runOperations(operations: readonly (() => void)[], message: string): void {
    const errors: unknown[] = [];

    for (const operation of operations) {
        try {
            operation();
        } catch (error) {
            errors.push(error);
        }
    }

    if (errors.length === 1) {
        throw errors[0];
    }

    if (errors.length > 1) {
        throw new AggregateError(errors, message);
    }
}

function flushCommittedEffects(): void {
    runOperations([flushTextHosts, flushBehaviors, flushAccessible], "Multiple committed effects failed");
}

const releaseElementStyle = (instance: ElementNode): void => {
    if (instance.object instanceof Gtk.Widget) {
        releaseStyle(instance.object);
    }
};

const detachElement = (instance: ElementNode): void => {
    try {
        runOperations(
            [
                () => {
                    forgetTextHost(instance);
                },
                () => {
                    disconnectAllHandlers(instance);
                },
                () => {
                    teardownBehaviors(instance);
                },
                () => {
                    releaseElementStyle(instance);
                },
            ],
            "Multiple element cleanup operations failed",
        );
    } finally {
        releaseManagedObject(instance.object);
        instance.reportError = null;
    }
};

const updateInstance = (instance: Instance, prev: Props, next: Props): void => {
    if (instance.kind === ELEMENT_KIND) {
        updateElementProps(instance, prev, next);

        return;
    }

    if (instance.kind === LAZY_KIND) {
        assertPropsCanChange(instance.typeName, prev, next);

        if (instance.adopted !== null) {
            applyAdoptedProps(lazyTarget(instance, instance.adopted), prev, next);
        }

        instance.props = next;
    }
};

const attachToContainer = (container: Container, child: AnyNode, before: AnyNode | null): void => {
    if (isRootElement(container.target)) {
        return;
    }

    const node = getOrCreateContainerNode(container.target);
    node.reportError = claimContainerTarget(container.target).reportError;
    node.isMounted = true;

    try {
        attachChild(node, child, before);
    } catch (error) {
        releaseEmptyContainerTarget(container.target, node);
        throw error;
    }
};

const detachFromContainer = (container: Container, child: AnyNode): void => {
    if (isRootElement(container.target)) {
        return;
    }

    const node = getOrCreateContainerNode(container.target);

    if (!isCurrentOwner(container.target)) {
        return;
    }

    detachChild(node, child);
    releaseEmptyContainerTarget(container.target, node);
};

const getPublicInstance = (instance: Instance): object | null => {
    if (instance.kind === ELEMENT_KIND) {
        return instance.object;
    }

    if (instance.kind === LAZY_KIND) {
        return instance.adopted;
    }

    return instance;
};

const setWidgetVisible = (instance: Instance, isVisible: boolean): void => {
    if (instance.kind !== ELEMENT_KIND || !(instance.object instanceof Gtk.Widget)) {
        return;
    }

    const widget = instance.object;

    applyWrite("visible", () => {
        widget.setVisible(isVisible);
    });
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
    getOrInsert(containerNodes, container, adoptContainer);

const currentCommitOwner = (): Container => {
    const owner = commitOwner.current;

    if (owner === null) {
        throw new Error("A native container can only be changed during a React commit");
    }

    return owner;
};

const ownershipFor = (object: GObject.Object): Ownership => {
    const owner = currentCommitOwner();
    const existing = ownership.get(object);

    if (existing !== undefined) {
        if (existing.owner !== owner) {
            throw new Error("A native object cannot be owned by more than one React root");
        }

        return existing;
    }

    const created: Ownership = { owner, managedCount: 0, isContainer: false };
    ownership.set(object, created);

    return created;
};

const deleteReleasedOwnership = (object: GObject.Object, record: Ownership): void => {
    if (record.managedCount === 0 && !record.isContainer) {
        ownership.delete(object);
    }
};

const claimManagedObject = (object: GObject.Object): Container => {
    const record = ownershipFor(object);
    record.managedCount += 1;

    return record.owner;
};

const releaseManagedObject = (object: GObject.Object): void => {
    const record = ownership.get(object);

    if (record === undefined || record.managedCount === 0) {
        return;
    }

    record.managedCount -= 1;
    deleteReleasedOwnership(object, record);
};

const claimContainerTarget = (target: GObject.Object): Container => {
    const record = ownershipFor(target);
    record.isContainer = true;

    return record.owner;
};

const hasPlacedChildren = (node: ElementNode): boolean => {
    for (const entries of node.placements.values()) {
        if (entries.length > 0) {
            return true;
        }
    }

    return false;
};

const releaseEmptyContainerTarget = (target: GObject.Object, node: ElementNode): void => {
    const record = ownership.get(target);
    const owner = commitOwner.current;

    if (record === undefined || owner === null || record.owner !== owner || hasPlacedChildren(node)) {
        return;
    }

    try {
        teardownBehaviors(node);
    } finally {
        node.reportError = null;
        record.isContainer = false;
        deleteReleasedOwnership(target, record);
    }
};

const isCurrentOwner = (target: GObject.Object): boolean => {
    const owner = commitOwner.current;

    return owner !== null && ownership.get(target)?.owner === owner;
};

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

export { createHostContainer, getPortalContainer, reconciler, type ContainerTarget };
