import {
    LAYOUT_CHILD_KIND,
    META_OBJECT_KIND,
    OVERLAY_KIND,
    TAB_LABEL_KIND,
    TEXT_ANCHOR_KIND,
    TEXT_PAINTABLE_KIND,
} from "@gtkx/config";

export type WrapperNodeElementSlot = {
    prop: string;
    kind: string;
};

export type WrapperNodeElement = {
    flatName: string;
    kind: string;
    propsType: string;
    slot?: WrapperNodeElementSlot;
};

const STACK_PAGE: WrapperNodeElement = {
    flatName: "GtkStackPage",
    kind: META_OBJECT_KIND,
    propsType: "StackPageProps",
};
const VIEW_STACK_PAGE: WrapperNodeElement = {
    flatName: "AdwViewStackPage",
    kind: META_OBJECT_KIND,
    propsType: "StackPageProps",
};
const NOTEBOOK_PAGE: WrapperNodeElement = {
    flatName: "GtkNotebookPage",
    kind: META_OBJECT_KIND,
    propsType: "NotebookPageProps",
    slot: { prop: "tabLabel", kind: TAB_LABEL_KIND },
};
const GRID_CHILD: WrapperNodeElement = {
    flatName: "GtkGridChild",
    kind: LAYOUT_CHILD_KIND,
    propsType: "GridChildProps",
};
const FIXED_CHILD: WrapperNodeElement = {
    flatName: "GtkFixedChild",
    kind: LAYOUT_CHILD_KIND,
    propsType: "FixedChildProps",
};
const OVERLAY_CHILD: WrapperNodeElement = {
    flatName: "GtkOverlayChild",
    kind: OVERLAY_KIND,
    propsType: "OverlayChildProps",
};
const TEXT_ANCHOR: WrapperNodeElement = {
    flatName: "GtkTextAnchor",
    kind: TEXT_ANCHOR_KIND,
    propsType: "TextAnchorProps",
};
const TEXT_PAINTABLE: WrapperNodeElement = {
    flatName: "GtkTextPaintable",
    kind: TEXT_PAINTABLE_KIND,
    propsType: "TextPaintableProps",
};

const TEXT_VIEW_SUBCOMPONENTS: WrapperNodeElement[] = [TEXT_ANCHOR, TEXT_PAINTABLE];

const WRAPPER_NODE_ELEMENTS_BY_PARENT: Record<string, WrapperNodeElement[]> = Object.freeze({
    GtkStack: [STACK_PAGE],
    AdwViewStack: [VIEW_STACK_PAGE],
    GtkNotebook: [NOTEBOOK_PAGE],
    GtkGrid: [GRID_CHILD],
    GtkFixed: [FIXED_CHILD],
    GtkOverlay: [OVERLAY_CHILD],
    GtkTextView: TEXT_VIEW_SUBCOMPONENTS,
    GtkSourceView: TEXT_VIEW_SUBCOMPONENTS,
});

export type WrapperNodeElementEntry = {
    parentGlibName: string;
    virtual: WrapperNodeElement;
};

export const wrapperNodeElementEntries = (): WrapperNodeElementEntry[] =>
    Object.entries(WRAPPER_NODE_ELEMENTS_BY_PARENT).flatMap(([parentGlibName, virtuals]) =>
        virtuals.map((virtual) => ({ parentGlibName, virtual })),
    );
