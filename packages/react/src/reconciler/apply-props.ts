import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { SignalHandler } from "@gtkx/runtime";
import { kebabCase } from "@gtkx/utils";
import { applyAccessibleProps, isAccessibleProp } from "../utils/accessible-props.js";
import type { Props } from "./elements.js";
import { type TypeInfo, typeInfoOf } from "./metadata.js";
import { contextFor, type ElementNode, type SignalTarget } from "./node.js";
import { connectHandler, disconnectHandler } from "./signals.js";

const REACT_RESERVED_PROPS = new Set(["children", "ref", "key"]);
const isHandlerName = (name: string): boolean => /^on[A-Z]/.test(name);

const signalForProp = (info: TypeInfo, name: string): string => {
    if (name === "onNotify") return "notify";
    if (name.startsWith("onNotify") && name.length > 8) return `notify::${kebabCase(name.slice(8))}`;
    return info.signals[name] ?? kebabCase(name.slice(2));
};

const isReservedName = (name: string, info: TypeInfo): boolean =>
    REACT_RESERVED_PROPS.has(name) || isHandlerName(name) || isAccessibleProp(name) || info.constructOnly.has(name);

const skipValueName = (name: string, info: TypeInfo, consumed: Set<string>): boolean =>
    isReservedName(name, info) || consumed.has(name);

type PropEntry = { name: string; value: unknown; oldValue: unknown };

const resetPlain = (object: GObject.Object, info: TypeInfo, name: string): void => {
    if (Object.hasOwn(info.defaults, name)) Reflect.set(object, name, info.defaults[name]);
};

const applyBufferText = (buffer: Gtk.TextBuffer, text: string): void => {
    if (buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false) === text) return;
    buffer.beginIrreversibleAction();
    buffer.setText(text, -1);
    buffer.endIrreversibleAction();
};

const isBufferText = (node: ElementNode, name: string): boolean =>
    name === "text" && node.contentKind === "buffer" && node.object instanceof Gtk.TextBuffer;

const applyEntry = (node: ElementNode, info: TypeInfo, entry: PropEntry): void => {
    const { name, value, oldValue } = entry;
    if (value === undefined) {
        resetPlain(node.object, info, name);
    } else if (isBufferText(node, name) && node.object instanceof Gtk.TextBuffer) {
        applyBufferText(node.object, String(value));
    } else if (value !== null || oldValue !== undefined) {
        Reflect.set(node.object, name, value);
    }
};

const eachChangedName = (oldProps: Props, newProps: Props, visit: (name: string) => void): void => {
    for (const name of new Set([...Object.keys(oldProps), ...Object.keys(newProps)])) visit(name);
};

const runBehaviorUpdates = (node: ElementNode, info: TypeInfo, oldProps: Props, newProps: Props): Set<string> => {
    const consumed = new Set<string>();
    for (const behavior of info.behaviors) {
        if (behavior.update === undefined) continue;
        const result = behavior.update(node.object, oldProps, newProps, contextFor(node, behavior));
        if (result !== undefined) for (const name of result) consumed.add(name);
    }
    return consumed;
};

type PropChange = { old: Props; next: Props };

const applyValueEntries = (node: ElementNode, info: TypeInfo, change: PropChange, consumed: Set<string>): void => {
    eachChangedName(change.old, change.next, (name) => {
        if (skipValueName(name, info, consumed) || Object.is(change.old[name], change.next[name])) return;
        applyEntry(node, info, { name, value: change.next[name], oldValue: change.old[name] });
    });
};

const restoreActionableSensitivity = (node: ElementNode, info: TypeInfo, oldProps: Props, newProps: Props): void => {
    if (oldProps.actionName === undefined || newProps.actionName !== undefined) return;
    const desired = "sensitive" in newProps ? newProps.sensitive : info.defaults.sensitive;
    if (typeof desired === "boolean") Reflect.set(node.object, "sensitive", desired);
};

const applyHandlers = (target: SignalTarget, info: TypeInfo, oldProps: Props, newProps: Props): void => {
    eachChangedName(oldProps, newProps, (name) => {
        if (!isHandlerName(name)) return;
        const value = newProps[name];
        if (typeof value === "function")
            connectHandler(target, name, signalForProp(info, name), value as SignalHandler);
        else disconnectHandler(target, name);
    });
};

const flushDirty = new Set<ElementNode>();

export const markFlush = (node: ElementNode): void => {
    if (typeInfoOf(node.typeName).hasFlush) flushDirty.add(node);
};

export const flushBehaviors = (): void => {
    for (const node of flushDirty) {
        for (const behavior of typeInfoOf(node.typeName).behaviors) {
            behavior.flush?.(node.object, contextFor(node, behavior));
        }
    }
    flushDirty.clear();
};

export const mountBehaviors = (node: ElementNode): void => {
    const info = typeInfoOf(node.typeName);
    if (!info.hasMount) return;
    for (const behavior of info.behaviors) behavior.mount?.(node.object, contextFor(node, behavior));
};

export const unmountBehaviors = (node: ElementNode): void => {
    for (const behavior of typeInfoOf(node.typeName).behaviors) {
        behavior.unmount?.(node.object, contextFor(node, behavior));
    }
};

const applyAccessible = (object: GObject.Object, oldProps: Props, newProps: Props): void => {
    if (object instanceof Gtk.Widget) applyAccessibleProps(object, oldProps, newProps);
};

export const applyElementProps = (node: ElementNode, oldProps: Props, newProps: Props): void => {
    const info = typeInfoOf(node.typeName);
    const consumed = runBehaviorUpdates(node, info, oldProps, newProps);
    applyValueEntries(node, info, { old: oldProps, next: newProps }, consumed);
    restoreActionableSensitivity(node, info, oldProps, newProps);
    applyAccessible(node.object, oldProps, newProps);
    applyHandlers(node, info, oldProps, newProps);
    markFlush(node);
    node.props = newProps;
};

const skipAdoptedName = (info: TypeInfo, name: string): boolean => isReservedName(name, info);

export const applyAdoptedProps = (target: SignalTarget, oldProps: Props, newProps: Props): void => {
    const { object, typeName } = target;
    const info = typeInfoOf(typeName);
    eachChangedName(oldProps, newProps, (name) => {
        if (skipAdoptedName(info, name) || Object.is(oldProps[name], newProps[name])) return;
        if (newProps[name] === undefined) resetPlain(object, info, name);
        else Reflect.set(object, name, newProps[name]);
    });
    applyAccessible(object, oldProps, newProps);
    applyHandlers(target, info, oldProps, newProps);
};
