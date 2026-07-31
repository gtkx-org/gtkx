import type * as GObject from "@gtkx/gi/gobject";
import type { SignalHandler } from "@gtkx/runtime";
import * as Gtk from "@gtkx/gi/gtk";
import { drain, kebabCase } from "@gtkx/utils";
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
const flushDirty: Set<ElementNode> = new Set();

const isHandlerName = (name: string): boolean => /^on[A-Z]/.test(name);

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

    applyWrite(object, () => {
        Reflect.set(object, name, value);
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

    applyWrite(buffer, () => {
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
    const names = new Set([...Object.keys(prev), ...Object.keys(next)]);

    for (const name of names) {
        visit(name);
    }
};

const constructOnlyChangeError = (typeName: string, name: string): Error =>
    new Error(
        `Cannot change the construct-only prop '${name}' of <${typeName}> after it is created. ` +
        "GTK accepts it only while the object is being built, so give the element a key that " +
        `changes with '${name}' and React will build a new one.`,
    );

const assertConstructOnlyUnchanged = (typeName: string, prev: Props, next: Props): void => {
    const info = typeInfoFor(typeName);

    eachChangedName(prev, next, (name) => {
        if (!info.constructOnly.has(name) || Object.is(prev[name], next[name])) {
            return;
        }

        throw constructOnlyChangeError(typeName, name);
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
        applyWrite(node.object, () => {
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

const mountBehaviors = (node: ElementNode): void => {
    if (!typeInfoFor(node.typeName).hasMount) {
        return;
    }

    eachBehavior(node, (behavior, context) => behavior.mount?.(node.object, context));
};

const unmountBehaviors = (node: ElementNode): void => {
    eachBehavior(node, (behavior, context) => behavior.unmount?.(node.object, context));
};

const applyAccessible = (object: GObject.Object, prev: Props, next: Props): void => {
    if (object instanceof Gtk.Widget) {
        applyAccessibleProps(object, prev, next);
    }
};

const applyElementProps = (node: ElementNode, prev: Props, next: Props): void => {
    const info = typeInfoFor(node.typeName);
    const consumed = runBehaviorUpdates(node, info, prev, next);
    applyValueEntries(node, info, { prev, next }, consumed);
    restoreActionableSensitivity(node, info, prev, next);
    applyAccessible(node.object, prev, next);
    applyHandlers(node, info, prev, next);
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
    flushBehaviors,
    mountBehaviors,
    unmountBehaviors,
    applyElementProps,
    applyAdoptedProps,
    assertConstructOnlyUnchanged,
};
