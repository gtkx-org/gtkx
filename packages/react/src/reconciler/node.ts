import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { SignalHandler } from "@gtkx/runtime";
import type { ContainerRule } from "./element-rules.js";
import { type ELEMENT_KIND, PROP_KIND, type Props, TEXT_KIND, WRAPPER_ELEMENT } from "./kinds.js";

export type ContentKind = "label" | "buffer" | "tag" | "anchor";

export type HandlerRecord = { signal: string; handler: SignalHandler; wrapped: SignalHandler; blockable: boolean };

export type SignalTarget = { object: GObject.Object; handlers: Map<string, HandlerRecord>; typeName: string };

export type AppliedList = { items: unknown[]; snapshot: unknown[] };

export type PlacedChild = {
    node: PlaceableNode;
    widget: GObject.Object;
    adopted: GObject.Object | null;
    rule: ContainerRule;
    attached: boolean;
};

export type ElementNode = {
    kind: typeof ELEMENT_KIND;
    typeName: string;
    object: GObject.Object;
    props: Props;
    handlers: Map<string, HandlerRecord>;
    placements: Map<string, PlacedChild[]>;
    objectSlots: Set<string>;
    lazyApplied: Map<string, unknown>;
    listApplied: Map<string, AppliedList>;
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

export type WrapperNode = {
    kind: typeof WRAPPER_ELEMENT;
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

export type PlaceableNode = ElementNode | WrapperNode;
export type ParentNode = ElementNode | PropNode | WrapperNode;
export type ContentChild = TextNode | ElementNode;
export type Instance = ElementNode | PropNode | WrapperNode;
export type AnyNode = Instance | TextNode;

export const createPropNode = (propName: string): PropNode => ({
    kind: PROP_KIND,
    propName,
    children: [],
    parent: null,
});

export const createWrapperNode = (props: Props): WrapperNode => ({
    kind: WRAPPER_ELEMENT,
    props,
    children: [],
    parent: null,
    adopted: null,
    handlers: new Map(),
});

export const createTextNode = (text: string): TextNode => ({ kind: TEXT_KIND, text, parent: null });

export const nodeWidget = (node: PlaceableNode): GObject.Object | null => {
    if (node.kind === WRAPPER_ELEMENT) {
        const child = node.children[0];
        return child === undefined ? null : nodeWidget(child);
    }
    return node.object;
};
