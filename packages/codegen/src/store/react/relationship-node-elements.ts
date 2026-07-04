import {
    LAYOUT_CHILD_KIND,
    META_OBJECT_KIND,
    OVERLAY_KIND,
    type RelationshipKind,
    TAB_LABEL_KIND,
    TEXT_ANCHOR_KIND,
    TEXT_PAINTABLE_KIND,
} from "@gtkx/config";

type RelationshipNodeElementSlot = {
    prop: string;
    kind: RelationshipKind;
};

export type RelationshipNodeElement = {
    flatName: string;
    kind: RelationshipKind;
    propsType: string;
    propsTypeArg?: string;
    slot?: RelationshipNodeElementSlot;
};

const STACK_PAGE: RelationshipNodeElement = {
    flatName: "GtkStackPage",
    kind: META_OBJECT_KIND,
    propsType: "StackPageProps",
};
const VIEW_STACK_PAGE: RelationshipNodeElement = {
    flatName: "AdwViewStackPage",
    kind: META_OBJECT_KIND,
    propsType: "StackPageProps",
    propsTypeArg: "Adw.ViewStackPage",
};
const NOTEBOOK_PAGE: RelationshipNodeElement = {
    flatName: "GtkNotebookPage",
    kind: META_OBJECT_KIND,
    propsType: "NotebookPageProps",
    slot: { prop: "tabLabel", kind: TAB_LABEL_KIND },
};
const GRID_CHILD: RelationshipNodeElement = {
    flatName: "GtkGridChild",
    kind: LAYOUT_CHILD_KIND,
    propsType: "GridChildProps",
};
const FIXED_CHILD: RelationshipNodeElement = {
    flatName: "GtkFixedChild",
    kind: LAYOUT_CHILD_KIND,
    propsType: "FixedChildProps",
};
const OVERLAY_CHILD: RelationshipNodeElement = {
    flatName: "GtkOverlayChild",
    kind: OVERLAY_KIND,
    propsType: "OverlayChildProps",
};
const TEXT_ANCHOR: RelationshipNodeElement = {
    flatName: "GtkTextAnchor",
    kind: TEXT_ANCHOR_KIND,
    propsType: "TextAnchorProps",
};
const TEXT_PAINTABLE: RelationshipNodeElement = {
    flatName: "GtkTextPaintable",
    kind: TEXT_PAINTABLE_KIND,
    propsType: "TextPaintableProps",
};

const TEXT_VIEW_SUBCOMPONENTS: RelationshipNodeElement[] = [TEXT_ANCHOR, TEXT_PAINTABLE];

const RELATIONSHIP_NODE_ELEMENTS_BY_PARENT: Record<string, RelationshipNodeElement[]> = {
    GtkStack: [STACK_PAGE],
    AdwViewStack: [VIEW_STACK_PAGE],
    GtkNotebook: [NOTEBOOK_PAGE],
    GtkGrid: [GRID_CHILD],
    GtkFixed: [FIXED_CHILD],
    GtkOverlay: [OVERLAY_CHILD],
    GtkTextView: TEXT_VIEW_SUBCOMPONENTS,
    GtkSourceView: TEXT_VIEW_SUBCOMPONENTS,
};

export type RelationshipNodeElementEntry = {
    parentGlibName: string;
    relationshipNode: RelationshipNodeElement;
};

export const relationshipNodeElementEntries = (): RelationshipNodeElementEntry[] =>
    Object.entries(RELATIONSHIP_NODE_ELEMENTS_BY_PARENT).flatMap(([parentGlibName, relationshipNodes]) =>
        relationshipNodes.map((relationshipNode) => ({ parentGlibName, relationshipNode })),
    );
