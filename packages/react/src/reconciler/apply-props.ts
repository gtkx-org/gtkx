import type { ListProp, ValueProp } from "@gtkx/config";
import * as Gtk from "@gtkx/gi/gtk";
import type * as GObject from "@gtkx/gi/gobject";
import type { SignalHandler } from "@gtkx/runtime";
import { kebabCase } from "@gtkx/utils";
import { applyAccessibleProps, isAccessibleProp } from "../utils/accessible-props.js";
import { runCall } from "./calls.js";
import type { Props } from "./kinds.js";
import { type TypeInfo, typeInfoOf } from "./metadata.js";
import type { ElementNode, SignalTarget } from "./node.js";
import { connectHandler, disconnectHandler } from "./signals.js";

const CONSUMED = new Set(["children", "ref", "key", "propName"]);

const isHandlerName = (name: string): boolean => /^on[A-Z]/.test(name);

const signalForProp = (info: TypeInfo, name: string): string => {
    if (name === "onNotify") return "notify";
    if (name.startsWith("onNotify") && name.length > 8) return `notify::${kebabCase(name.slice(8))}`;
    return info.signals[name] ?? kebabCase(name.slice(2));
};

const skipValueName = (name: string, info: TypeInfo): boolean =>
    CONSUMED.has(name) ||
    isHandlerName(name) ||
    isAccessibleProp(name) ||
    info.containerProps.has(name) ||
    info.constructOnly.has(name) ||
    info.lazyProps.has(name);

const applyValueRule = (object: GObject.Object, rule: ValueProp, value: unknown, props: Props): void => {
    runCall(object, rule.call, { props }, [value]);
    if (rule.after !== undefined) runCall(object, rule.after, {}, []);
};

type PropEntry = { name: string; value: unknown; oldValue: unknown; props: Props };

const addListItem = (object: GObject.Object, rule: ListProp, item: unknown, props: Props): void => {
    const adds = Array.isArray(rule.add) ? rule.add : [rule.add];
    for (const call of adds) runCall(object, call, { item, props }, [item]);
};

const applyListRule = (node: ElementNode, rule: ListProp, entry: PropEntry): void => {
    const { name, value, props } = entry;
    const items = Array.isArray(value) ? value : [];
    if (rule.clear !== undefined) {
        runCall(node.object, rule.clear, {}, []);
    } else if (rule.remove !== undefined) {
        for (const item of node.listApplied.get(name) ?? []) {
            runCall(node.object, rule.remove, { item, props }, [item]);
        }
    }
    for (const item of items) addListItem(node.object, rule, item, props);
    node.listApplied.set(name, items);
};

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
    const { name, value, oldValue, props } = entry;
    const valueRule = info.valueProps.get(name);
    const listRule = info.listProps.get(name);
    if (valueRule !== undefined) {
        if (value !== undefined) applyValueRule(node.object, valueRule, value, props);
    } else if (listRule !== undefined) {
        applyListRule(node, listRule, entry);
    } else if (info.controlledText.has(name)) {
        if (value !== undefined) Reflect.set(node.object, name, value);
    } else if (value === undefined) {
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

const applyValueEntries = (node: ElementNode, info: TypeInfo, oldProps: Props, newProps: Props): void => {
    eachChangedName(oldProps, newProps, (name) => {
        if (skipValueName(name, info) || Object.is(oldProps[name], newProps[name])) return;
        applyEntry(node, info, { name, value: newProps[name], oldValue: oldProps[name], props: newProps });
    });
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

const lazyDirty = new Set<ElementNode>();

export const markLazyDirty = (node: ElementNode): void => {
    if (typeInfoOf(node.typeName).lazyProps.size > 0) lazyDirty.add(node);
};

const applyLazyForNode = (node: ElementNode): void => {
    const info = typeInfoOf(node.typeName);
    for (const [name, rule] of info.lazyProps) {
        const desired = node.props[name];
        if (desired === undefined || Object.is(node.lazyApplied.get(name), desired)) continue;
        if (rule.lookup !== undefined && !runCall(node.object, rule.lookup, {}, [desired])) continue;
        Reflect.set(node.object, name, desired);
        node.lazyApplied.set(name, desired);
    }
};

export const flushLazyProps = (): void => {
    for (const node of lazyDirty) applyLazyForNode(node);
    lazyDirty.clear();
};

const trackLazy = (node: ElementNode, info: TypeInfo, oldProps: Props, newProps: Props): void => {
    for (const name of info.lazyProps.keys()) {
        if (!Object.is(oldProps[name], newProps[name])) {
            markLazyDirty(node);
            return;
        }
    }
};

const applyAccessible = (object: GObject.Object, oldProps: Props, newProps: Props): void => {
    if (object instanceof Gtk.Widget) applyAccessibleProps(object, oldProps, newProps);
};

export const applyElementProps = (node: ElementNode, oldProps: Props, newProps: Props): void => {
    const info = typeInfoOf(node.typeName);
    applyValueEntries(node, info, oldProps, newProps);
    applyAccessible(node.object, oldProps, newProps);
    applyHandlers(node, info, oldProps, newProps);
    trackLazy(node, info, oldProps, newProps);
    node.props = newProps;
};

const skipAdoptedName = (info: TypeInfo, name: string): boolean =>
    CONSUMED.has(name) || isHandlerName(name) || isAccessibleProp(name) || info.constructOnly.has(name);

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
