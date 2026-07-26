import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { SignalHandler } from "@gtkx/runtime";
import { getOrInsert } from "@gtkx/utils";
import type { ElementBehavior, Props } from "./registry.js";

export const ELEMENT_KIND = "element";
export const PROP_KIND = "prop";
export const TEXT_KIND = "text";
export const LAZY_KIND = "lazy";

export const DEFAULT_SLOT = "children";

export type ContentKind = "label" | "buffer" | "tag" | "anchor";

export type HandlerRecord = { signal: string; handler: SignalHandler; wrapped: SignalHandler; blockable: boolean };

export type Dispatch = (fn: () => unknown) => unknown;

export type SignalTarget = {
    object: GObject.Object;
    handlers: Map<string, HandlerRecord>;
    typeName: string;
    dispatch: Dispatch;
};

export type PlacedChild = {
    node: PlaceableNode;
    object: GObject.Object;
    adopted: GObject.Object | null;
    slot: string;
    behavior: ElementBehavior | null;
    attached: boolean;
};

export type ElementNode = SignalTarget & {
    kind: typeof ELEMENT_KIND;
    props: Props;
    placements: Map<string, PlacedChild[]>;
    contexts: Map<ElementBehavior, unknown>;
    parent: ParentNode | null;
    content: ContentChild[];
    contentKind: ContentKind | null;
    bufferView: Gtk.TextView | null;
};

export type PropNode = {
    kind: typeof PROP_KIND;
    slot: string;
    children: PlaceableNode[];
    parent: ElementNode | null;
};

export type LazyNode = {
    kind: typeof LAZY_KIND;
    typeName: string;
    props: Props;
    children: PlaceableNode[];
    parent: ElementNode | null;
    adopted: GObject.Object | null;
    handlers: Map<string, HandlerRecord>;
    dispatch: Dispatch;
};

export type TextNode = {
    kind: typeof TEXT_KIND;
    text: string;
    parent: ParentNode | null;
};

export type PlaceableNode = ElementNode | LazyNode;
export type ParentNode = ElementNode | PropNode | LazyNode;
export type ContentChild = TextNode | ElementNode;
export type Instance = ElementNode | PropNode | LazyNode;
export type AnyNode = Instance | TextNode;

export const createPropNode = (slot: string): PropNode => ({
    kind: PROP_KIND,
    slot,
    children: [],
    parent: null,
});

export const createLazyNode = (typeName: string, props: Props, dispatch: Dispatch): LazyNode => ({
    kind: LAZY_KIND,
    typeName,
    props,
    children: [],
    parent: null,
    adopted: null,
    handlers: new Map(),
    dispatch,
});

export const createElementNode = (
    typeName: string,
    object: GObject.Object,
    dispatch: Dispatch,
    contentKind: ContentKind | null,
): ElementNode => ({
    kind: ELEMENT_KIND,
    typeName,
    object,
    props: {},
    handlers: new Map(),
    placements: new Map(),
    contexts: new Map(),
    parent: null,
    content: [],
    contentKind,
    bufferView: null,
    dispatch,
});

export const createTextNode = (text: string): TextNode => ({ kind: TEXT_KIND, text, parent: null });

export const nodeObject = (node: PlaceableNode): GObject.Object | null => {
    if (node.kind === LAZY_KIND) {
        const [child] = node.children;
        return child === undefined ? null : nodeObject(child);
    }
    return node.object;
};

export const lazyTarget = (node: LazyNode, adopted: GObject.Object): SignalTarget => ({
    object: adopted,
    handlers: node.handlers,
    typeName: node.typeName,
    dispatch: node.dispatch,
});

export const contextFor = (node: ElementNode, behavior: ElementBehavior): unknown =>
    getOrInsert(node.contexts, behavior, () => behavior.createContext?.(node.object));
