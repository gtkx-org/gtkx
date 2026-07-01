export const RELATIONSHIP_NODE_ELEMENT = "__GTKX_RELATIONSHIP_NODE__";

export const RELATIONSHIP_KINDS = [
    "meta-object",
    "layout-child",
    "overlay",
    "tab-label",
    "widget-prop",
    "container-slot",
    "text-anchor",
    "text-paintable",
    "buffer-text",
    "label-text",
] as const;

export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

const RELATIONSHIP_KIND_SET: ReadonlySet<string> = new Set(RELATIONSHIP_KINDS);

export const isRelationshipKind = (value: unknown): value is RelationshipKind =>
    typeof value === "string" && RELATIONSHIP_KIND_SET.has(value);

export const META_OBJECT_KIND: RelationshipKind = "meta-object";

export const LAYOUT_CHILD_KIND: RelationshipKind = "layout-child";

export const OVERLAY_KIND: RelationshipKind = "overlay";

export const TAB_LABEL_KIND: RelationshipKind = "tab-label";

export const WIDGET_PROP_KIND: RelationshipKind = "widget-prop";

export const CONTAINER_SLOT_KIND: RelationshipKind = "container-slot";

export const TEXT_ANCHOR_KIND: RelationshipKind = "text-anchor";

export const TEXT_PAINTABLE_KIND: RelationshipKind = "text-paintable";

export const BUFFER_TEXT_KIND: RelationshipKind = "buffer-text";

export const LABEL_TEXT_KIND: RelationshipKind = "label-text";

export type AttachShape =
    | "append"
    | "add"
    | "setContent"
    | "setChild"
    | "getChild"
    | "remove"
    | "reorderChildAfter"
    | "insertChildAfter"
    | "insert"
    | "getFirstChild";

export type AttachShapeTable = Record<string, AttachShape[]>;

type AddMethodArg = "widget" | "id" | "title" | "iconName";

export type AddMethodRule = {
    method: string;
    args: AddMethodArg[];
    requires: AddMethodArg[];
};

export type PageMetaSetter = {
    setter: string;
    prop: string;
    fallback?: unknown;
    whenPresent?: boolean;
};

export type OrderedInsertSpec = {
    collection: string;
    attach: string;
    detach: string;
};

export interface RuleNode {
    instance: object;
    props: Record<string, unknown>;
    slotTag: string | undefined;
}

/**
 * Runtime services injected into rule callbacks by the host reconciler
 * (`@gtkx/react`). Rules are duck-typed and never import the generated GObject
 * bindings, so any genuine runtime type check goes through here.
 */
export type RuleContext = {
    /** Whether `instance` is, or derives from, the GObject type named `typeName` (respecting interfaces). */
    instanceIsA: (instance: object, typeName: string) => boolean;
};

export interface RuleSet {
    appendChild?: (parent: RuleNode, child: RuleNode, ctx: RuleContext) => void;
    removeChild?: (parent: RuleNode, child: RuleNode, ctx: RuleContext) => void;
    setProps?: (
        node: RuleNode,
        newProps: Record<string, unknown>,
        oldProps: Record<string, unknown> | null,
        ctx: RuleContext,
    ) => void;
}

export type RuleRegistry = Record<string, RuleSet>;
