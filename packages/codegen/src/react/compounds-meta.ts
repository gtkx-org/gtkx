import {
    LAYOUT_CHILD_KIND,
    META_OBJECT_KIND,
    OVERLAY_KIND,
    TAB_LABEL_KIND,
    TEXT_ANCHOR_KIND,
    TEXT_PAINTABLE_KIND,
} from "@gtkx/config";

export type VirtualSubcomponentSlot = {
    prop: string;
    kind: string;
};

export type VirtualSubcomponent = {
    flatName: string;
    kind: string;
    propsType: string;
    slot?: VirtualSubcomponentSlot;
};

const STACK_PAGE: VirtualSubcomponent = {
    flatName: "GtkStackPage",
    kind: META_OBJECT_KIND,
    propsType: "StackPageProps",
};
const VIEW_STACK_PAGE: VirtualSubcomponent = {
    flatName: "AdwViewStackPage",
    kind: META_OBJECT_KIND,
    propsType: "StackPageProps",
};
const NOTEBOOK_PAGE: VirtualSubcomponent = {
    flatName: "GtkNotebookPage",
    kind: META_OBJECT_KIND,
    propsType: "NotebookPageProps",
    slot: { prop: "tabLabel", kind: TAB_LABEL_KIND },
};
const GRID_CHILD: VirtualSubcomponent = {
    flatName: "GtkGridChild",
    kind: LAYOUT_CHILD_KIND,
    propsType: "GridChildProps",
};
const FIXED_CHILD: VirtualSubcomponent = {
    flatName: "GtkFixedChild",
    kind: LAYOUT_CHILD_KIND,
    propsType: "FixedChildProps",
};
const OVERLAY_CHILD: VirtualSubcomponent = {
    flatName: "GtkOverlayChild",
    kind: OVERLAY_KIND,
    propsType: "OverlayChildProps",
};
const TEXT_ANCHOR: VirtualSubcomponent = {
    flatName: "GtkTextAnchor",
    kind: TEXT_ANCHOR_KIND,
    propsType: "TextAnchorProps",
};
const TEXT_PAINTABLE: VirtualSubcomponent = {
    flatName: "GtkTextPaintable",
    kind: TEXT_PAINTABLE_KIND,
    propsType: "TextPaintableProps",
};

const TEXT_VIEW_SUBCOMPONENTS: VirtualSubcomponent[] = [TEXT_ANCHOR, TEXT_PAINTABLE];

const VIRTUAL_SUBCOMPONENTS: Record<string, VirtualSubcomponent[]> = Object.freeze({
    GtkStack: [STACK_PAGE],
    AdwViewStack: [VIEW_STACK_PAGE],
    GtkNotebook: [NOTEBOOK_PAGE],
    GtkGrid: [GRID_CHILD],
    GtkFixed: [FIXED_CHILD],
    GtkOverlay: [OVERLAY_CHILD],
    GtkTextView: TEXT_VIEW_SUBCOMPONENTS,
    GtkSourceView: TEXT_VIEW_SUBCOMPONENTS,
});

export type VirtualSubcomponentEntry = {
    parentGlibName: string;
    virtual: VirtualSubcomponent;
};

export const virtualSubcomponentEntries = (): VirtualSubcomponentEntry[] =>
    Object.entries(VIRTUAL_SUBCOMPONENTS).flatMap(([parentGlibName, virtuals]) =>
        virtuals.map((virtual) => ({ parentGlibName, virtual })),
    );
