import type { SignalHandler } from "@gtkx/runtime";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getInstanceType, signalForHandlerName, TYPE_INVALID } from "@gtkx/runtime";
import { prepareObjectPropertyValue } from "@gtkx/runtime/internal";
import { drain, isDeepEqual, kebabCase, lowerFirst, unsanitizeIdentifier } from "@gtkx/utils";
import type { ElementBehavior, Props } from "./registry.js";
import { applyAccessibleProps, isAccessibleProp, validateAccessibleProps } from "../utils/accessible-props.js";
import { reportReconcilerError, runWithErrorReporter } from "./commit-errors.js";
import { LAZY_PUBLIC_INSTANCE_PROP } from "./lazy-public-instance.js";
import { getPropertyName, hasProperty, type TypeInfo, typeInfoFor, typeInfoForProps } from "./metadata.js";
import { type ElementNode, getOrCreateContext, type SignalTarget } from "./node.js";
import { applyWrite, connectHandler, disconnectHandler } from "./signals.js";
import { bufferText, hasSameText, isContentPaintableProp, markTextDirty, TEXT_PROP } from "./text.js";

type PropDelta = { name: string; value: unknown; prevValue: unknown };
type BehaviorUpdateContext = { node: ElementNode; prev: Props; next: Props; consumed: Set<string> };
type PropChange = { prev: Props; next: Props };

const REACT_RESERVED_PROPS = new Set(["children", "ref", "key", LAZY_PUBLIC_INSTANCE_PROP]);
const NOTIFY_PREFIX = "onNotify";
const HANDLER_NAME = /^on[A-Z]/;
const flushDirty: Set<ElementNode> = new Set();
const accessibleDirty: Map<ElementNode, Props> = new Map();
const mapWatched: WeakMap<ElementNode, () => void> = new WeakMap();
const pendingMap: Set<ElementNode> = new Set();

const isHandlerName = (name: string): boolean => HANDLER_NAME.test(name);
const notifiedAccessor = (name: string): string => lowerFirst(name.slice(NOTIFY_PREFIX.length));

const unknownSignalError = (typeName: string, name: string): Error =>
    new Error(
        `The handler prop '${name}' of <${typeName}> names no signal ${typeName} carries. Name a ` +
        `signal the element carries, or declare the one '${name}' stands for on ${typeName} when ` +
        "its class is registered.",
    );

const lookedUpSignal = (target: SignalTarget, name: string): string => {
    const type = getInstanceType(target.object);
    const signal = type === TYPE_INVALID ? undefined : signalForHandlerName(type, name);

    if (signal === undefined) {
        throw unknownSignalError(target.typeName, name);
    }

    return signal;
};

const signalForProp = (target: SignalTarget, info: TypeInfo, name: string): string => {
    if (name === NOTIFY_PREFIX) {
        return "notify";
    }

    if (name.startsWith(NOTIFY_PREFIX) && name.length > NOTIFY_PREFIX.length) {
        const accessor = notifiedAccessor(name);
        const property = getPropertyName(target.object, accessor) ?? unsanitizeIdentifier(kebabCase(accessor));

        return `notify::${property}`;
    }

    return info.signals[name] ?? lookedUpSignal(target, name);
};

const isReservedName = (name: string, info: TypeInfo): boolean =>
    REACT_RESERVED_PROPS.has(name) ||
    (isHandlerName(name) && !hasProperty(info, name)) ||
    (isAccessibleProp(name) && !hasProperty(info, name)) ||
    info.constructOnly.has(name);

const isSkippedValueName = (name: string, info: TypeInfo, consumed: Set<string>): boolean =>
    isReservedName(name, info) || consumed.has(name);

const writeValue = (object: GObject.Object, name: string, value: unknown): void => {
    if (hasSameText(object, name, value)) {
        return;
    }

    applyWrite(name, () => {
        Reflect.set(object, name, prepareObjectPropertyValue(object, name, value));
    });
};

const resetPlain = (object: GObject.Object, info: TypeInfo, name: string): void => {
    if (Object.hasOwn(info.defaults, name)) {
        writeValue(object, name, info.defaults[name]);
    }
};

const setOrReset = (object: GObject.Object, info: TypeInfo, name: string, value: unknown): void => {
    if (value === undefined) {
        resetPlain(object, info, name);
    } else {
        writeValue(object, name, value);
    }
};

const applyBufferText = (buffer: Gtk.TextBuffer, text: string): void => {
    if (bufferText(buffer) === text) {
        return;
    }

    applyWrite(TEXT_PROP, () => {
        buffer.beginIrreversibleAction();
        buffer.setText(text, -1);
        buffer.endIrreversibleAction();
    });
};

const isBufferText = (node: ElementNode, name: string): node is ElementNode & { object: Gtk.TextBuffer } =>
    name === TEXT_PROP && node.contentKind === "buffer" && node.object instanceof Gtk.TextBuffer;

const propText = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value));

const applyEntry = (node: ElementNode, info: TypeInfo, delta: PropDelta): void => {
    const { name, value, prevValue } = delta;

    if (value !== undefined && isBufferText(node, name)) {
        applyBufferText(node.object, propText(value));

        return;
    }

    if (isContentPaintableProp(node, name)) {
        markTextDirty(node);

        return;
    }

    const isInitialNull = value === null && prevValue === undefined;

    if (!isInitialNull) {
        setOrReset(node.object, info, name, value);
    }
};

const eachChangedName = (prev: Props, next: Props, visit: (name: string) => void): void => {
    for (const name in prev) {
        visit(name);
    }

    for (const name in next) {
        if (!Object.hasOwn(prev, name)) {
            visit(name);
        }
    }
};

const propChangeError = (typeName: string, name: string): Error =>
    new Error(
        `Cannot change the construct-only prop '${name}' of <${typeName}> after it is created. ` +
        "It is only accepted while the element is being built, so give the element a key that " +
        `changes with '${name}' and React will build a new one.`,
    );

const hasAppliedValue = (value: unknown): boolean => (Array.isArray(value) ? value.length > 0 : value !== undefined);

const isConstructOnlyChange = (info: TypeInfo, name: string, change: PropChange): boolean =>
    info.constructOnly.has(name) && !Object.is(change.prev[name], change.next[name]);

const isDeclaredConstructOnlyChange = (info: TypeInfo, name: string, change: PropChange): boolean =>
    info.declaredConstructOnly.has(name) &&
    hasAppliedValue(change.prev[name]) &&
    !isDeepEqual(change.prev[name], change.next[name]);

const assertPropsCanChange = (typeName: string, prev: Props, next: Props): void => {
    const info = typeInfoForProps(typeName, prev, next);
    const change: PropChange = { prev, next };

    eachChangedName(prev, next, (name) => {
        if (isConstructOnlyChange(info, name, change) || isDeclaredConstructOnlyChange(info, name, change)) {
            throw propChangeError(typeName, name);
        }
    });
};

const collectConsumed = (ctx: BehaviorUpdateContext, behavior: ElementBehavior): void => {
    if (behavior.update === undefined) {
        return;
    }

    const result = behavior.update(ctx.node.object, ctx.prev, ctx.next, getOrCreateContext(ctx.node, behavior));

    if (result === undefined) {
        return;
    }

    for (const name of result) {
        ctx.consumed.add(name);
    }
};

const runBehaviorValidations = (node: ElementNode, info: TypeInfo, prev: Props, next: Props): void => {
    for (const behavior of info.behaviors) {
        behavior.validate?.(node.object, prev, next, getOrCreateContext(node, behavior));
    }
};

const runBehaviorUpdates = (node: ElementNode, info: TypeInfo, prev: Props, next: Props): Set<string> => {
    const consumed: Set<string> = new Set();
    const ctx: BehaviorUpdateContext = { node, prev, next, consumed };

    for (const behavior of info.behaviors) {
        collectConsumed(ctx, behavior);
    }

    return consumed;
};

const applyValueEntries = (node: ElementNode, info: TypeInfo, change: PropChange, consumed: Set<string>): void => {
    eachChangedName(change.prev, change.next, (name) => {
        if (isSkippedValueName(name, info, consumed) || Object.is(change.prev[name], change.next[name])) {
            return;
        }

        applyEntry(node, info, { name, value: change.next[name], prevValue: change.prev[name] });
    });
};

const restoreActionableSensitivity = (node: ElementNode, info: TypeInfo, prev: Props, next: Props): void => {
    if (prev.actionName === undefined || next.actionName !== undefined) {
        return;
    }

    const desired = "sensitive" in next ? next.sensitive : info.defaults.sensitive;

    if (typeof desired === "boolean") {
        applyWrite("sensitive", () => {
            Reflect.set(node.object, "sensitive", desired);
        });
    }
};

const applyHandler = (target: SignalTarget, info: TypeInfo, name: string, next: Props): void => {
    const value = next[name];

    if (value === undefined || value === null) {
        disconnectHandler(target, name);

        return;
    }

    if (typeof value !== "function") {
        throw new TypeError(
            `The handler prop '${name}' of <${target.typeName}> must be a function, null, or undefined`,
        );
    }

    connectHandler(target, name, signalForProp(target, info, name), value as SignalHandler);
};

const validateHandler = (target: SignalTarget, info: TypeInfo, name: string, next: Props): void => {
    const value = next[name];

    if (value === undefined || value === null) {
        return;
    }

    if (typeof value !== "function") {
        throw new TypeError(
            `The handler prop '${name}' of <${target.typeName}> must be a function, null, or undefined`,
        );
    }

    signalForProp(target, info, name);
};

const validateHandlers = (target: SignalTarget, info: TypeInfo, prev: Props, next: Props): void => {
    eachChangedName(prev, next, (name) => {
        if (isHandlerName(name) && !hasProperty(info, name)) {
            validateHandler(target, info, name, next);
        }
    });
};

const applyHandlers = (target: SignalTarget, info: TypeInfo, prev: Props, next: Props): void => {
    eachChangedName(prev, next, (name) => {
        if (isHandlerName(name) && !hasProperty(info, name)) {
            applyHandler(target, info, name, next);
        }
    });
};

const shouldValidateValue = (info: TypeInfo, name: string, prev: Props, next: Props): boolean => {
    const value = next[name];
    const isInitialNull = value === null && prev[name] === undefined;

    return !isReservedName(name, info) &&
        !info.deferred.has(name) &&
        hasProperty(info, name) &&
        !Object.is(prev[name], value) &&
        value !== undefined &&
        !isInitialNull;
};

const validateValueEntries = (object: GObject.Object, info: TypeInfo, prev: Props, next: Props): void => {
    eachChangedName(prev, next, (name) => {
        if (shouldValidateValue(info, name, prev, next)) {
            prepareObjectPropertyValue(object, name, next[name]);
        }
    });
};

const markFlush = (node: ElementNode): void => {
    if (node.isMounted && typeInfoFor(node.typeName).hasFlush) {
        flushDirty.add(node);
    }
};

const eachBehavior = (node: ElementNode, visit: (behavior: ElementBehavior, context: unknown) => void): void => {
    for (const behavior of typeInfoFor(node.typeName).behaviors) {
        visit(behavior, getOrCreateContext(node, behavior));
    }
};

const flushNodeBehaviors = (node: ElementNode): void => {
    const reportError = node.reportError ?? reportReconcilerError;
    eachBehavior(node, (behavior, context) => behavior.flush?.(node.object, context, reportError));
};

const flushBehaviors = (): void => {
    drain(flushDirty, flushNodeBehaviors);
};

const teardownBehaviors = (node: ElementNode): void => {
    node.isMounted = false;
    flushDirty.delete(node);
    unwatchMap(node);
    const contexts = new Set(node.contexts);

    try {
        drain(contexts, ([behavior, context]) => {
            behavior.teardown?.(node.object, context);
        });
    } finally {
        node.contexts.clear();
    }
};

const applyAccessible = (object: GObject.Object, info: TypeInfo, prev: Props | null, next: Props): void => {
    if (object instanceof Gtk.Accessible) {
        applyAccessibleProps(object, prev, next, (name) => !hasProperty(info, name));
    }
};

const validateAccessible = (object: GObject.Object, info: TypeInfo, next: Props): void => {
    if (object instanceof Gtk.Accessible) {
        validateAccessibleProps(next, (name) => !hasProperty(info, name));
    }
};

const markAccessible = (node: ElementNode, prev: Props): void => {
    if (node.isMounted && !accessibleDirty.has(node)) {
        accessibleDirty.set(node, prev);
    }
};

const hasAccessibleProp = (props: Props, info: TypeInfo): boolean => {
    for (const name in props) {
        if (isAccessibleProp(name) && !hasProperty(info, name)) {
            return true;
        }
    }

    return false;
};

const watchMap = (node: ElementNode, info: TypeInfo): void => {
    const { object } = node;

    if (mapWatched.has(node) || !(object instanceof Gtk.Widget) || !hasAccessibleProp(node.props, info)) {
        return;
    }

    const onMapped = (): undefined => {
        pendingMap.add(node);
        setTimeout(settleAccessible, 0);
    };

    object.on("map", onMapped);

    mapWatched.set(node, () => {
        object.off("map", onMapped);
    });
};

const unwatchMap = (node: ElementNode): void => {
    mapWatched.get(node)?.();
    mapWatched.delete(node);
    pendingMap.delete(node);
    accessibleDirty.delete(node);
};

const settleAccessible = (): void => {
    drain(pendingMap, (node) => {
        runWithErrorReporter(node.reportError, () => {
            if (!(node.object instanceof Gtk.Widget) || !node.object.getMapped()) {
                return;
            }

            const info = typeInfoForProps(node.typeName, node.props);
            applyAccessible(node.object, info, null, node.props);
        });
    });
};

const flushAccessible = (): void => {
    const entries = new Set(accessibleDirty);

    try {
        drain(entries, ([node, prev]) => {
            const info = typeInfoForProps(node.typeName, prev, node.props);
            applyAccessible(node.object, info, prev, node.props);
            watchMap(node, info);
        });
    } finally {
        accessibleDirty.clear();
    }
};

const mountElementProps = (node: ElementNode): void => {
    prepareElementProps(node);
    node.isMounted = true;
    flushNodeBehaviors(node);
    const info = typeInfoForProps(node.typeName, {}, node.props);
    applyAccessible(node.object, info, null, node.props);
    watchMap(node, info);
};

const prepareElementProps = (node: ElementNode): void => {
    const info = typeInfoForProps(node.typeName, {}, node.props);
    applyHandlers(node, info, {}, node.props);
};

const commitElementProps = (node: ElementNode, prev: Props, next: Props, isUpdate: boolean): void => {
    try {
        const info = typeInfoForProps(node.typeName, prev, next);

        if (isUpdate) {
            assertPropsCanChange(node.typeName, prev, next);
        }

        validateAccessible(node.object, info, next);
        validateHandlers(node, info, prev, next);
        validateValueEntries(node.object, info, prev, next);
        runBehaviorValidations(node, info, prev, next);
        const consumed = runBehaviorUpdates(node, info, prev, next);
        applyValueEntries(node, info, { prev, next }, consumed);
        restoreActionableSensitivity(node, info, prev, next);

        if (isUpdate) {
            applyHandlers(node, info, prev, next);
        }

        markAccessible(node, prev);
        markFlush(node);
        node.props = next;
    } catch (error) {
        flushDirty.delete(node);
        accessibleDirty.delete(node);
        throw error;
    }
};

const applyElementProps = (node: ElementNode, prev: Props, next: Props): void => {
    commitElementProps(node, prev, next, false);
};

const updateElementProps = (node: ElementNode, prev: Props, next: Props): void => {
    commitElementProps(node, prev, next, true);
};

const isSkippedAdoptedName = (info: TypeInfo, name: string): boolean => isReservedName(name, info);

const applyAdoptedProps = (target: SignalTarget, prev: Props, next: Props): void => {
    const { object, typeName } = target;
    const info = typeInfoForProps(typeName, prev, next);
    validateAccessible(object, info, next);
    validateHandlers(target, info, prev, next);
    validateValueEntries(object, info, prev, next);

    eachChangedName(prev, next, (name) => {
        if (isSkippedAdoptedName(info, name) || Object.is(prev[name], next[name])) {
            return;
        }

        setOrReset(object, info, name, next[name]);
    });

    applyAccessible(object, info, prev, next);
    applyHandlers(target, info, prev, next);
};

export {
    markFlush,
    mountElementProps,
    flushAccessible,
    settleAccessible,
    flushBehaviors,
    teardownBehaviors,
    applyElementProps,
    updateElementProps,
    applyAdoptedProps,
    prepareElementProps,
    assertPropsCanChange,
};
