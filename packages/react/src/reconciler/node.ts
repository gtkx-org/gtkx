import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { SignalHandler } from "@gtkx/runtime";
import type { ElementBehavior, Props } from "./elements.js";

export const ELEMENT_KIND = "element";
export const PROP_KIND = "prop";
export const TEXT_KIND = "text";
export const LAZY_KIND = "lazy";

export type ContentKind = "label" | "buffer" | "tag" | "anchor";

export type HandlerRecord = { signal: string; handler: SignalHandler; wrapped: SignalHandler; blockable: boolean };

export type SignalTarget = { object: GObject.Object; handlers: Map<string, HandlerRecord>; typeName: string };

export type PlacedChild = {
    node: PlaceableNode;
    widget: GObject.Object;
    adopted: GObject.Object | null;
    slot: string;
    behavior: ElementBehavior | null;
    attached: boolean;
};

export type ElementNode = {
    kind: typeof ELEMENT_KIND;
    typeName: string;
    object: GObject.Object;
    props: Props;
    handlers: Map<string, HandlerRecord>;
    placements: Map<string, PlacedChild[]>;
    contexts: Map<ElementBehavior, unknown>;
    parent: ParentNode | null;
    content: ContentChild[] | null;
    contentKind: ContentKind | null;
    bufferView: Gtk.TextView | null;
};

export type PropNode = {
    kind: typeof PROP_KIND;
    propName: string;
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

export const createPropNode = (propName: string): PropNode => ({
    kind: PROP_KIND,
    propName,
    children: [],
    parent: null,
});

export const createLazyNode = (typeName: string, props: Props): LazyNode => ({
    kind: LAZY_KIND,
    typeName,
    props,
    children: [],
    parent: null,
    adopted: null,
    handlers: new Map(),
});

export const createTextNode = (text: string): TextNode => ({ kind: TEXT_KIND, text, parent: null });

export const nodeWidget = (node: PlaceableNode): GObject.Object | null => {
    if (node.kind === LAZY_KIND) {
        const child = node.children[0];
        return child === undefined ? null : nodeWidget(child);
    }
    return node.object;
};

/** The per-node context a behavior builds once via `createContext`, memoized on the node. */
export const contextFor = (node: ElementNode, behavior: ElementBehavior): unknown => {
    if (!node.contexts.has(behavior)) node.contexts.set(behavior, behavior.createContext?.(node.object));
    return node.contexts.get(behavior);
};
