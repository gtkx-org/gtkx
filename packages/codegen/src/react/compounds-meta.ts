/**
 * Virtual-child subcomponent mapping — JSX element name to the map of
 * subcomponent property → virtual JSX intrinsic name it routes through.
 *
 * For example `GtkStack.Page` renders the `<StackPage>` virtual
 * intrinsic so the reconciler can attach a child to the stack with
 * its page metadata. Unlike container slots, virtual subcomponents
 * render an existing intrinsic element rather than invoking a setter
 * on the parent widget.
 *
 * The list is small and stable; defining it in code keeps the lookup
 * fast and avoids one more GIR-introspection pass.
 */
/**
 * One virtual-child subcomponent: the `child` property the parent exposes, the
 * JSX intrinsic (or wrapper-kind virtual) it renders, the public prop type that
 * types it, and an optional `renameProps` map translating an ergonomic public
 * prop to the GObject property name the intrinsic expects (e.g. a text tag's
 * `id` to the construct-only `name`).
 */
export type VirtualSubcomponent = {
    readonly child: string;
    readonly intrinsic: string;
    readonly propsType: string;
    readonly renameProps?: Readonly<Record<string, string>>;
};

const TEXT_TAG: VirtualSubcomponent = {
    child: "Tag",
    intrinsic: "GtkTextTag",
    propsType: "TextTagProps",
    renameProps: { id: "name" },
};
const TEXT_ANCHOR: VirtualSubcomponent = { child: "Anchor", intrinsic: "TextAnchor", propsType: "TextAnchorProps" };
const TEXT_PAINTABLE: VirtualSubcomponent = {
    child: "Paintable",
    intrinsic: "TextPaintable",
    propsType: "TextPaintableProps",
};

const TEXT_VIEW_SUBCOMPONENTS: readonly VirtualSubcomponent[] = [TEXT_TAG, TEXT_ANCHOR, TEXT_PAINTABLE];

const VIRTUAL_SUBCOMPONENTS: Readonly<Record<string, readonly VirtualSubcomponent[]>> = Object.freeze({
    GtkStack: [{ child: "Page", intrinsic: "StackPage", propsType: "StackPageProps" }],
    AdwViewStack: [{ child: "Page", intrinsic: "StackPage", propsType: "StackPageProps" }],
    GtkNotebook: [
        { child: "Page", intrinsic: "NotebookPage", propsType: "NotebookPageProps" },
        { child: "PageTab", intrinsic: "NotebookPageTab", propsType: "NotebookPageTabProps" },
    ],
    GtkGrid: [{ child: "Child", intrinsic: "GridChild", propsType: "GridChildProps" }],
    GtkFixed: [{ child: "Child", intrinsic: "FixedChild", propsType: "FixedChildProps" }],
    GtkOverlay: [{ child: "Child", intrinsic: "OverlayChild", propsType: "OverlayChildProps" }],
    GtkTextView: TEXT_VIEW_SUBCOMPONENTS,
    GtkSourceView: TEXT_VIEW_SUBCOMPONENTS,
});

/**
 * Returns the virtual-subcomponent records for a JSX element name, or an
 * empty array if no virtual subcomponents exist.
 *
 * @param jsxName - The JSX element name (PascalCase / GLib type name)
 */
export const virtualSubcomponentsFor = (jsxName: string): readonly VirtualSubcomponent[] =>
    VIRTUAL_SUBCOMPONENTS[jsxName] ?? [];

/**
 * Maps a virtual-subcomponent intrinsic name to the generic wrapper kind the
 * reconciler resolves at runtime. Intrinsics absent from this map render a real
 * GObject intrinsic element directly (e.g. `GtkTextTag`) rather than a wrapper.
 */
const WRAPPER_KIND_BY_INTRINSIC: Readonly<Record<string, string>> = Object.freeze({
    StackPage: "meta-object",
    NotebookPage: "meta-object",
    NotebookPageTab: "notebook-tab",
    GridChild: "layout-child",
    FixedChild: "layout-child",
    OverlayChild: "overlay",
    TextAnchor: "text-anchor",
    TextPaintable: "text-paintable",
});

/**
 * Returns the generic wrapper kind for a virtual-subcomponent intrinsic, or
 * `null` when the intrinsic renders a real GObject element directly.
 *
 * @param intrinsic - The virtual intrinsic name (e.g. `"StackPage"`).
 */
export const wrapperKindForIntrinsic = (intrinsic: string): string | null =>
    WRAPPER_KIND_BY_INTRINSIC[intrinsic] ?? null;
