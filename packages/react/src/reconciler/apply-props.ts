import type * as GObject from "@gtkx/gi/gobject";
import type { SignalHandler } from "@gtkx/runtime";
import * as Gtk from "@gtkx/gi/gtk";
import { coerceObjectProperty } from "@gtkx/runtime";
import { drain, isDeepEqual, kebabCase } from "@gtkx/utils";
import type { ElementBehavior, Props } from "./registry.js";
import { applyAccessibleProps, isAccessibleProp } from "../utils/accessible-props.js";
import { type TypeInfo, typeInfoFor } from "./metadata.js";
import { type ElementNode, getOrCreateContext, type SignalTarget } from "./node.js";
import { applyWrite, connectHandler, disconnectHandler } from "./signals.js";
import { bufferText, hasSameText, isContentPaintableProp, markTextDirty, TEXT_PROP } from "./text.js";

type PropDelta = { name: string; value: unknown; prevValue: unknown };
type BehaviorUpdateContext = { node: ElementNode; prev: Props; next: Props; consumed: Set<string> };
type PropChange = { prev: Props; next: Props };

const REACT_RESERVED_PROPS = new Set(["children", "ref", "key"]);
const NOTIFY_PREFIX = "onNotify";
const HANDLER_PREFIX = "on";
const HANDLER_NAME = /^on[A-Z]/;
const flushDirty: Set<ElementNode> = new Set();
const accessibleDirty: Map<ElementNode, Props> = new Map();
const mapWatched: WeakSet<ElementNode> = new WeakSet();
const pendingMap: Set<ElementNode> = new Set();

const isHandlerName = (name: string): boolean => HANDLER_NAME.test(name);

const signalForProp = (info: TypeInfo, name: string): string => {
    if (name === NOTIFY_PREFIX) {
        return "notify";
    }

    if (name.startsWith(NOTIFY_PREFIX) && name.length > NOTIFY_PREFIX.length) {
        return `notify::${kebabCase(name.slice(NOTIFY_PREFIX.length))}`;
    }

    return info.signals[name] ?? kebabCase(name.slice(HANDLER_PREFIX.length));
};

const isReservedName = (name: string, info: TypeInfo): boolean =>
    REACT_RESERVED_PROPS.has(name) || isHandlerName(name) || isAccessibleProp(name) || info.constructOnly.has(name);

const isSkippedValueName = (name: string, info: TypeInfo, consumed: Set<string>): boolean =>
    isReservedName(name, info) || consumed.has(name);

const writeValue = (object: GObject.Object, name: string, value: unknown): void => {
    if (hasSameText(object, name, value)) {
        return;
    }

    applyWrite(() => {
        Reflect.set(object, name, coerceObjectProperty(object, name, value));
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

    applyWrite(() => {
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
    const info = typeInfoFor(typeName);
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
        applyWrite(() => {
            Reflect.set(node.object, "sensitive", desired);
        });
    }
};

const applyHandlers = (target: SignalTarget, info: TypeInfo, prev: Props, next: Props): void => {
    eachChangedName(prev, next, (name) => {
        if (!isHandlerName(name)) {
            return;
        }

        const value = next[name];

        if (typeof value === "function") {
            connectHandler(target, name, signalForProp(info, name), value as SignalHandler);
        } else {
            disconnectHandler(target, name);
        }
    });
};

const markFlush = (node: ElementNode): void => {
    if (typeInfoFor(node.typeName).hasFlush) {
        flushDirty.add(node);
    }
};

const eachBehavior = (node: ElementNode, visit: (behavior: ElementBehavior, context: unknown) => void): void => {
    for (const behavior of typeInfoFor(node.typeName).behaviors) {
        visit(behavior, getOrCreateContext(node, behavior));
    }
};

const flushBehaviors = (): void => {
    drain(flushDirty, (node) => {
        eachBehavior(node, (behavior, context) => behavior.flush?.(node.object, context));
    });
};

const applyAccessible = (object: GObject.Object, prev: Props | null, next: Props): void => {
    if (object instanceof Gtk.Accessible) {
        applyAccessibleProps(object, prev, next);
    }
};

const markAccessible = (node: ElementNode, prev: Props): void => {
    if (!accessibleDirty.has(node)) {
        accessibleDirty.set(node, prev);
    }
};

const hasAccessibleProp = (props: Props): boolean => {
    for (const name in props) {
        if (isAccessibleProp(name)) {
            return true;
        }
    }

    return false;
};

const watchMap = (node: ElementNode): void => {
    const { object } = node;

    if (mapWatched.has(node) || !(object instanceof Gtk.Widget) || !hasAccessibleProp(node.props)) {
        return;
    }

    mapWatched.add(node);

    object.connect("map", () => {
        pendingMap.add(node);
        setTimeout(settleAccessible, 0);
    });
};

const settleAccessible = (): void => {
    drain(pendingMap, (node) => {
        if (node.object instanceof Gtk.Widget && node.object.getMapped()) {
            applyAccessible(node.object, null, node.props);
        }
    });
};

const flushAccessible = (): void => {
    for (const [node, prev] of accessibleDirty) {
        applyAccessible(node.object, prev, node.props);
        watchMap(node);
    }

    accessibleDirty.clear();
};

const applyElementProps = (node: ElementNode, prev: Props, next: Props): void => {
    const info = typeInfoFor(node.typeName);
    const consumed = runBehaviorUpdates(node, info, prev, next);
    applyValueEntries(node, info, { prev, next }, consumed);
    restoreActionableSensitivity(node, info, prev, next);
    applyHandlers(node, info, prev, next);
    markAccessible(node, prev);
    markFlush(node);
    node.props = next;
};

const isSkippedAdoptedName = (info: TypeInfo, name: string): boolean => isReservedName(name, info);

const applyAdoptedProps = (target: SignalTarget, prev: Props, next: Props): void => {
    const { object, typeName } = target;
    const info = typeInfoFor(typeName);

    eachChangedName(prev, next, (name) => {
        if (isSkippedAdoptedName(info, name) || Object.is(prev[name], next[name])) {
            return;
        }

        setOrReset(object, info, name, next[name]);
    });

    applyAccessible(object, prev, next);
    applyHandlers(target, info, prev, next);
};

export {
    markFlush,
    flushAccessible,
    settleAccessible,
    flushBehaviors,
    applyElementProps,
    applyAdoptedProps,
    assertPropsCanChange,
};
