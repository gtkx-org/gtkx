import type * as GObject from "@gtkx/gi/gobject";
import { getInstanceType, TYPE_INVALID, typeFromName, typeIsA, typeName } from "@gtkx/runtime";
import { applyAdoptedProps, markLazyDirty } from "./apply-props.js";
import type { ContainerRule, PlaceContext } from "./element-rules.js";
import { WRAPPER_ELEMENT } from "./kinds.js";
import { type TypeInfo, typeInfoOf } from "./metadata.js";
import { type ElementNode, nodeWidget, type PlaceableNode, type PlacedChild, type SignalTarget } from "./node.js";

const childTypeCache = new Map<string, bigint>();

const childTypeOf = (name: string): bigint => {
    let type = childTypeCache.get(name);
    if (type === undefined) {
        type = typeFromName(name);
        childTypeCache.set(name, type);
    }
    return type;
};

const matchRule = (info: TypeInfo, prop: string, widgetType: bigint): ContainerRule | null => {
    for (const rule of info.containerRules) {
        if (rule.prop !== prop) continue;
        const childType = childTypeOf(rule.child);
        if (childType === TYPE_INVALID || typeIsA(widgetType, childType)) return rule;
    }
    return null;
};

export const ruleFor = (parent: ElementNode, prop: string, node: PlaceableNode): ContainerRule | null => {
    const widget = nodeWidget(node);
    if (widget === null) return null;
    return matchRule(typeInfoOf(parent.typeName), prop, getInstanceType(widget));
};

const isObject = (value: unknown): value is GObject.Object => typeof value === "object" && value !== null;

const createEntry = (rule: ContainerRule, node: PlaceableNode): PlacedChild | null => {
    const inner = nodeWidget(node);
    if (inner === null) return null;
    const widget = rule.autowrap === undefined ? inner : rule.autowrap(inner);
    return { node, widget, adopted: null, rule, attached: false };
};

const placeContext = (entry: PlacedChild, index: number, sibling: GObject.Object | null): PlaceContext => ({
    index,
    sibling,
    adopted: entry.adopted,
    props: entry.node.props,
});

const computeAdopted = (parent: ElementNode, entry: PlacedChild, result: unknown): GObject.Object | null => {
    const adopt = entry.rule.adopt;
    if (adopt === undefined) return null;
    if (adopt === "result") return isObject(result) ? result : null;
    return entry.rule.behavior.resolve?.(parent.object, entry.widget) ?? null;
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
    const attach = entry.rule.behavior.attach;
    if (attach === undefined) return;
    runPlacement(parent, entry, attach(parent.object, entry.widget, placeContext(entry, index, null)));
};

const insertEntry = (parent: ElementNode, entry: PlacedChild, list: PlacedChild[], index: number): void => {
    const sibling = siblingAt(list, index);
    const insert = entry.rule.behavior.insert;
    if (insert === undefined) return;
    runPlacement(parent, entry, insert(parent.object, entry.widget, placeContext(entry, index, sibling)));
};

const detachEntry = (parent: ElementNode, entry: PlacedChild): void => {
    if (!entry.attached) return;
    entry.attached = false;
    entry.rule.behavior.detach?.(parent.object, entry.widget, { adopted: entry.adopted, props: entry.node.props });
};

const rebuild = (parent: ElementNode, list: PlacedChild[]): void => {
    for (const entry of list) detachEntry(parent, entry);
    list.forEach((entry, index) => {
        appendEntry(parent, entry, index);
    });
};

const reorderEntry = (parent: ElementNode, entry: PlacedChild, list: PlacedChild[], index: number): void => {
    const sibling = siblingAt(list, index);
    entry.rule.behavior.reorder?.(parent.object, entry.widget, placeContext(entry, index, sibling));
};

type SyncOptions = { list: PlacedChild[]; index: number; isMove: boolean };

const syncPlacement = (parent: ElementNode, entry: PlacedChild, options: SyncOptions): void => {
    const { list, index, isMove } = options;
    const { behavior } = entry.rule;
    const canInsert = behavior.insert !== undefined;
    const canReorder = behavior.reorder !== undefined;
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
