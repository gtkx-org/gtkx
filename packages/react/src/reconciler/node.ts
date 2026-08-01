import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { SignalHandler } from "@gtkx/runtime";
import { getOrInsert } from "@gtkx/utils";
import type { ElementBehavior, Props } from "./registry.js";

type ContentKind = "label" | "buffer" | "tag" | "anchor";
type HandlerRecord = { signal: string; handler: SignalHandler; wrapped: SignalHandler; isBlockable: boolean };
type Dispatch = (fn: () => unknown) => unknown;

type SignalTarget = {
    object: GObject.Object;
    handlers: Map<string, HandlerRecord>;
    typeName: string;
    dispatch: Dispatch;
};

type PlacedChild = {
    node: PlaceableNode;
    object: GObject.Object;
    adopted: GObject.Object | null;
    slot: string;
    behavior: ElementBehavior | null;
    isAttached: boolean;
};

type ElementNode = SignalTarget & {
    kind: typeof ELEMENT_KIND;
    props: Props;
    placements: Map<string, PlacedChild[]>;
    contexts: Map<ElementBehavior, unknown>;
    parent: ParentNode | null;
    content: ContentChild[];
    contentKind: ContentKind | null;
    bufferView: Gtk.TextView | null;
};

type PropNode = {
    kind: typeof PROP_KIND;
    slot: string;
    children: PlaceableNode[];
    parent: ElementNode | null;
};

type LazyNode = {
    kind: typeof LAZY_KIND;
    typeName: string;
    props: Props;
    children: PlaceableNode[];
    parent: ElementNode | null;
    adopted: GObject.Object | null;
    handlers: Map<string, HandlerRecord>;
    dispatch: Dispatch;
};

type TextNode = {
    kind: typeof TEXT_KIND;
    text: string;
    parent: ParentNode | null;
};

type PlaceableNode = ElementNode | LazyNode;
type ParentNode = ElementNode | PropNode | LazyNode;
type ContentChild = TextNode | ElementNode;
type Instance = ElementNode | PropNode | LazyNode;
type AnyNode = Instance | TextNode;

const ELEMENT_KIND = "element";
const PROP_KIND = "prop";
const TEXT_KIND = "text";
const LAZY_KIND = "lazy";
const DEFAULT_SLOT = "children";

const createPropNode = (slot: string): PropNode => ({
    kind: PROP_KIND,
    slot,
    children: [],
    parent: null,
});

const createLazyNode = (typeName: string, props: Props, dispatch: Dispatch): LazyNode => ({
    kind: LAZY_KIND,
    typeName,
    props,
    children: [],
    parent: null,
    adopted: null,
    handlers: new Map(),
    dispatch,
});

const createElementNode = (
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

const createTextNode = (text: string): TextNode => ({ kind: TEXT_KIND, text, parent: null });

const nodeObject = (node: PlaceableNode): GObject.Object | null => {
    if (node.kind === LAZY_KIND) {
        const [child] = node.children;

        return child === undefined ? null : nodeObject(child);
    }

    return node.object;
};

const lazyTarget = (node: LazyNode, adopted: GObject.Object): SignalTarget => ({
    object: adopted,
    handlers: node.handlers,
    typeName: node.typeName,
    dispatch: node.dispatch,
});

const getOrCreateContext = (node: ElementNode, behavior: ElementBehavior): unknown =>
    getOrInsert(node.contexts, behavior, () => behavior.initialize?.(node.object));

export {
    ELEMENT_KIND,
    PROP_KIND,
    TEXT_KIND,
    LAZY_KIND,
    DEFAULT_SLOT,
    createPropNode,
    createLazyNode,
    createElementNode,
    createTextNode,
    nodeObject,
    lazyTarget,
    getOrCreateContext,
    type ContentKind,
    type HandlerRecord,
    type Dispatch,
    type SignalTarget,
    type PlacedChild,
    type ElementNode,
    type PropNode,
    type LazyNode,
    type TextNode,
    type PlaceableNode,
    type ParentNode,
    type ContentChild,
    type Instance,
    type AnyNode,
};
