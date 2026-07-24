import type { ContainerProp } from "@gtkx/config";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getInstanceType, getWrapperClass, TYPE_INVALID, typeFromName, typeIsA, typeName } from "@gtkx/runtime";
import { applyAdoptedProps, markLazyDirty } from "./apply-props.js";
import { callMethod, runCall } from "./calls.js";
import type { ContainerBehavior, PlaceContext } from "./element-rules.js";
import { type Props, WRAPPER_ELEMENT } from "./kinds.js";
import { type TypeInfo, typeInfoOf } from "./metadata.js";
import { type ElementNode, nodeWidget, type PlaceableNode, type PlacedChild, type SignalTarget } from "./node.js";

type WidgetConstructor = new (props: Props) => GObject.Object;

const childTypeCache = new Map<string, bigint>();

const childTypeOf = (name: string): bigint => {
    let type = childTypeCache.get(name);
    if (type === undefined) {
        type = typeFromName(name);
        childTypeCache.set(name, type);
    }
    return type;
};

const matchRule = (info: TypeInfo, prop: string, widgetType: bigint): ContainerProp | null => {
    for (const rule of info.containerRules) {
        if (rule.prop !== prop) continue;
        const childType = childTypeOf(rule.child);
        if (childType === TYPE_INVALID || typeIsA(widgetType, childType)) return rule;
    }
    return null;
};

const FALLBACK_RULE: ContainerProp = { kind: "container", prop: "children", child: "GtkWidget" };

export const ruleFor = (parent: ElementNode, prop: string, node: PlaceableNode): ContainerProp | null => {
    const widget = nodeWidget(node);
    if (widget === null) return null;
    const rule = matchRule(typeInfoOf(parent.typeName), prop, getInstanceType(widget));
    if (rule !== null) return rule;
    if (prop === "children" && widget instanceof Gtk.Widget) return FALLBACK_RULE;
    return null;
};

const isObject = (value: unknown): value is GObject.Object => typeof value === "object" && value !== null;

const autowrap = (wrapperTypeName: string, inner: GObject.Object): GObject.Object => {
    const wrapperType = childTypeOf(wrapperTypeName);
    if (wrapperType !== TYPE_INVALID && typeIsA(getInstanceType(inner), wrapperType)) return inner;
    const cls = getWrapperClass(typeFromName(wrapperTypeName)) as WidgetConstructor;
    const wrapper = new cls({});
    callMethod(wrapper, "setChild", [inner]);
    return wrapper;
};

const createEntry = (rule: ContainerProp, node: PlaceableNode): PlacedChild | null => {
    const inner = nodeWidget(node);
    if (inner === null) return null;
    const widget = rule.autowrap === undefined ? inner : autowrap(rule.autowrap, inner);
    return { node, widget, adopted: null, rule, attached: false };
};

const behaviorOf = (parent: ElementNode, rule: ContainerProp): ContainerBehavior | undefined =>
    rule === FALLBACK_RULE
        ? undefined
        : typeInfoOf(parent.typeName).containerBehaviors.get(`${rule.prop}:${rule.child}`);

const placeContext = (entry: PlacedChild, index: number, sibling: GObject.Object | null): PlaceContext => ({
    index,
    sibling,
    adopted: entry.adopted,
    props: entry.node.props,
});

const computeAdopted = (parent: ElementNode, entry: PlacedChild, result: unknown): GObject.Object | null => {
    const adopt = entry.rule.adopt;
    if (adopt === undefined) return null;
    if (adopt === true) return isObject(result) ? result : null;
    if (typeof adopt !== "string")
        return behaviorOf(parent, entry.rule)?.resolve?.(parent.object, entry.widget) ?? null;
    const adopted = callMethod(parent.object, adopt, [entry.widget]);
    return isObject(adopted) ? adopted : null;
};

const applyWrapperProps = (entry: PlacedChild): void => {
    if (entry.node.kind !== WRAPPER_ELEMENT || entry.adopted === null) return;
    const target: SignalTarget = {
        object: entry.adopted,
        handlers: entry.node.handlers,
        typeName: typeName(getInstanceType(entry.adopted)) ?? "",
    };
    applyAdoptedProps(target, {}, entry.node.props);
    entry.node.adopted = entry.adopted;
};

const runPlacement = (parent: ElementNode, entry: PlacedChild, result: unknown): void => {
    entry.adopted = computeAdopted(parent, entry, result);
    entry.attached = true;
    applyWrapperProps(entry);
};

const siblingAt = (list: PlacedChild[], index: number): GObject.Object | null =>
    index > 0 ? (list[index - 1]?.widget ?? null) : null;

const appendEntry = (parent: ElementNode, entry: PlacedChild, index: number): void => {
    if (entry.rule === FALLBACK_RULE) {
        callMethod(entry.widget, "setParent", [parent.object]);
        entry.attached = true;
        return;
    }
    const attach = behaviorOf(parent, entry.rule)?.attach;
    if (attach !== undefined) {
        runPlacement(parent, entry, attach(parent.object, entry.widget, placeContext(entry, index, null)));
        return;
    }
    if (entry.rule.append === undefined) return;
    runPlacement(parent, entry, runCall(parent.object, entry.rule.append, [entry.widget]));
};

const insertEntry = (parent: ElementNode, entry: PlacedChild, list: PlacedChild[], index: number): void => {
    const sibling = siblingAt(list, index);
    const insert = behaviorOf(parent, entry.rule)?.insert;
    if (insert !== undefined) {
        runPlacement(parent, entry, insert(parent.object, entry.widget, placeContext(entry, index, sibling)));
        return;
    }
    if (entry.rule.insert === undefined) return;
    runPlacement(parent, entry, runCall(parent.object, entry.rule.insert, [entry.widget]));
};

const detachDefault = (parent: ElementNode, entry: PlacedChild): void => {
    if (entry.rule !== FALLBACK_RULE && typeof Reflect.get(parent.object, "remove") === "function") {
        callMethod(parent.object, "remove", [entry.widget]);
    } else {
        callMethod(entry.widget, "unparent", []);
    }
};

const detachEntry = (parent: ElementNode, entry: PlacedChild): void => {
    if (!entry.attached) return;
    entry.attached = false;
    const detach = behaviorOf(parent, entry.rule)?.detach;
    if (detach !== undefined) {
        detach(parent.object, entry.widget, { adopted: entry.adopted, props: entry.node.props });
    } else if (entry.rule !== FALLBACK_RULE && entry.rule.remove !== undefined) {
        runCall(parent.object, entry.rule.remove, [entry.widget]);
    } else {
        detachDefault(parent, entry);
    }
};

const rebuild = (parent: ElementNode, list: PlacedChild[]): void => {
    for (const entry of list) detachEntry(parent, entry);
    list.forEach((entry, index) => {
        appendEntry(parent, entry, index);
    });
};

const reorderEntry = (parent: ElementNode, entry: PlacedChild, list: PlacedChild[], index: number): void => {
    const sibling = siblingAt(list, index);
    const reorder = behaviorOf(parent, entry.rule)?.reorder;
    if (reorder !== undefined) {
        reorder(parent.object, entry.widget, placeContext(entry, index, sibling));
        return;
    }
    if (entry.rule.reorder !== undefined) runCall(parent.object, entry.rule.reorder, [entry.widget]);
};

type SyncOptions = { list: PlacedChild[]; index: number; isMove: boolean };

const syncPlacement = (parent: ElementNode, entry: PlacedChild, options: SyncOptions): void => {
    const { list, index, isMove } = options;
    const behavior = behaviorOf(parent, entry.rule);
    const canInsert = entry.rule.insert !== undefined || behavior?.insert !== undefined;
    const canReorder = entry.rule.reorder !== undefined || behavior?.reorder !== undefined;
    if (!isMove && index === list.length - 1) appendEntry(parent, entry, index);
    else if (!isMove && canInsert && canReorder) insertEntry(parent, entry, list, index);
    else if (isMove && canReorder) reorderEntry(parent, entry, list, index);
    else rebuild(parent, list);
};

const positionOf = (list: PlacedChild[], before: PlaceableNode | null): number => {
    if (before === null) return list.length;
    const index = list.findIndex((entry) => entry.node === before);
    return index < 0 ? list.length : index;
};

export const placeChild = (
    parent: ElementNode,
    prop: string,
    node: PlaceableNode,
    before: PlaceableNode | null,
): void => {
    const rule = ruleFor(parent, prop, node);
    if (rule === null) return;
    const list = parent.placements.get(prop) ?? [];
    parent.placements.set(prop, list);
    const existing = list.findIndex((entry) => entry.node === node);
    const entry = existing >= 0 ? list[existing] : createEntry(rule, node);
    if (entry === undefined || entry === null) return;
    if (existing >= 0) list.splice(existing, 1);
    const index = positionOf(list, before);
    list.splice(index, 0, entry);
    syncPlacement(parent, entry, { list, index, isMove: existing >= 0 });
    markLazyDirty(parent);
};

export const unplaceChild = (parent: ElementNode, prop: string, node: PlaceableNode): void => {
    const list = parent.placements.get(prop);
    if (list === undefined) return;
    const index = list.findIndex((entry) => entry.node === node);
    if (index < 0) return;
    const [entry] = list.splice(index, 1);
    if (entry !== undefined) detachEntry(parent, entry);
    markLazyDirty(parent);
};
