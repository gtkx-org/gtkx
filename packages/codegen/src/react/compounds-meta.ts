/**
 * Virtual-child subcomponent mapping — the flat, top-level components that stand
 * in for a parent's metadata children (`<GtkStackPage>` for a stack page,
 * `<GtkGridChild>` for a grid cell, …). Each renders the `__GTKX_WRAPPER_NODE__`
 * sentinel carrying a generic wrapper kind plus its metadata props, which the
 * reconciler's element map attaches to the grandparent.
 *
 * The list is small and stable; defining it in code keeps the lookup fast and
 * avoids one more GIR-introspection pass.
 */

/**
 * An optional slot a virtual subcomponent desugars from a single `ReactNode`
 * prop into a nested inert wrapper child the enclosing meta-object consumes
 * positionally.
 */
export type VirtualSubcomponentSlot = {
    /** The prop name carrying the `ReactNode` (e.g. `"tabLabel"`). */
    readonly prop: string;
    /** The wrapper kind the nested child is emitted with (e.g. `"tab-label"`). */
    readonly kind: string;
};

/**
 * One virtual-child subcomponent: the flat top-level component name it is
 * emitted as (e.g. `"GtkStackPage"`), the generic wrapper kind the reconciler
 * resolves at runtime, the public prop type that types it, and an optional
 * {@link VirtualSubcomponentSlot} desugared from a `ReactNode` prop into a
 * nested wrapper child.
 */
export type VirtualSubcomponent = {
    readonly flatName: string;
    readonly kind: string;
    readonly propsType: string;
    readonly slot?: VirtualSubcomponentSlot;
};

const STACK_PAGE: VirtualSubcomponent = { flatName: "GtkStackPage", kind: "meta-object", propsType: "StackPageProps" };
const VIEW_STACK_PAGE: VirtualSubcomponent = {
    flatName: "AdwViewStackPage",
    kind: "meta-object",
    propsType: "StackPageProps",
};
const NOTEBOOK_PAGE: VirtualSubcomponent = {
    flatName: "GtkNotebookPage",
    kind: "meta-object",
    propsType: "NotebookPageProps",
    slot: { prop: "tabLabel", kind: "tab-label" },
};
const GRID_CHILD: VirtualSubcomponent = { flatName: "GtkGridChild", kind: "layout-child", propsType: "GridChildProps" };
const FIXED_CHILD: VirtualSubcomponent = {
    flatName: "GtkFixedChild",
    kind: "layout-child",
    propsType: "FixedChildProps",
};
const OVERLAY_CHILD: VirtualSubcomponent = {
    flatName: "GtkOverlayChild",
    kind: "overlay",
    propsType: "OverlayChildProps",
};
const TEXT_ANCHOR: VirtualSubcomponent = {
    flatName: "GtkTextAnchor",
    kind: "text-anchor",
    propsType: "TextAnchorProps",
};
const TEXT_PAINTABLE: VirtualSubcomponent = {
    flatName: "GtkTextPaintable",
    kind: "text-paintable",
    propsType: "TextPaintableProps",
};

const TEXT_VIEW_SUBCOMPONENTS: readonly VirtualSubcomponent[] = [TEXT_ANCHOR, TEXT_PAINTABLE];

const VIRTUAL_SUBCOMPONENTS: Readonly<Record<string, readonly VirtualSubcomponent[]>> = Object.freeze({
    GtkStack: [STACK_PAGE],
    AdwViewStack: [VIEW_STACK_PAGE],
    GtkNotebook: [NOTEBOOK_PAGE],
    GtkGrid: [GRID_CHILD],
    GtkFixed: [FIXED_CHILD],
    GtkOverlay: [OVERLAY_CHILD],
    GtkTextView: TEXT_VIEW_SUBCOMPONENTS,
    GtkSourceView: TEXT_VIEW_SUBCOMPONENTS,
});

/**
 * Returns every distinct flat virtual subcomponent across all parents,
 * deduplicated by {@link VirtualSubcomponent.flatName} (the text anchor and
 * paintable are shared by both text-view kinds).
 */
export const allVirtualSubcomponents = (): readonly VirtualSubcomponent[] => {
    const seen = new Set<string>();
    const result: VirtualSubcomponent[] = [];
    for (const virtuals of Object.values(VIRTUAL_SUBCOMPONENTS)) {
        for (const virtual of virtuals) {
            if (seen.has(virtual.flatName)) continue;
            seen.add(virtual.flatName);
            result.push(virtual);
        }
    }
    return result.sort((a, b) => a.flatName.localeCompare(b.flatName));
};
