/**
 * Compound Children Config
 *
 * Declares non-GIR-derivable compound sub-components: virtual children,
 * menu hosts, and navigation pages. These are React-specific abstractions
 * with no direct GIR representation.
 */

export type VirtualChildConfig = {
    readonly sub: string;
    readonly intrinsic: string;
    readonly props: string;
};

export type NavigationPageConfig = {
    readonly sub: string;
    readonly forValue: string;
    readonly props: string;
};

export type CompoundChildrenConfig = {
    readonly virtualChildren?: readonly VirtualChildConfig[];
    readonly menuHost?: true;
    readonly navigationPages?: readonly NavigationPageConfig[];
};

const COMPOUND_CHILDREN: Readonly<Record<string, CompoundChildrenConfig>> = {
    GtkGrid: {
        virtualChildren: [{ sub: "Child", intrinsic: "GridChild", props: "GridChildProps" }],
    },
    GtkStack: {
        virtualChildren: [{ sub: "Page", intrinsic: "StackPage", props: "StackPageProps" }],
    },
    AdwViewStack: {
        virtualChildren: [{ sub: "Page", intrinsic: "StackPage", props: "StackPageProps" }],
    },
    GtkNotebook: {
        virtualChildren: [
            { sub: "Page", intrinsic: "NotebookPage", props: "NotebookPageProps" },
            { sub: "PageTab", intrinsic: "NotebookPageTab", props: "NotebookPageTabProps" },
        ],
    },
    GtkOverlay: {
        virtualChildren: [{ sub: "Child", intrinsic: "OverlayChild", props: "OverlayChildProps" }],
    },
    GtkFixed: {
        virtualChildren: [{ sub: "Child", intrinsic: "FixedChild", props: "FixedChildProps" }],
    },
    GtkShortcutController: {
        virtualChildren: [{ sub: "Shortcut", intrinsic: "Shortcut", props: "ShortcutProps" }],
    },
    GtkConstraintLayout: {
        virtualChildren: [
            { sub: "Constraint", intrinsic: "Constraint", props: "ConstraintProps" },
            { sub: "Guide", intrinsic: "ConstraintGuide", props: "ConstraintGuideProps" },
            { sub: "Vfl", intrinsic: "ConstraintVfl", props: "ConstraintVflProps" },
            { sub: "Widget", intrinsic: "ConstraintLayoutWidget", props: "ConstraintLayoutWidgetProps" },
        ],
    },
    GtkMenuButton: { menuHost: true },
    GtkPopoverMenu: { menuHost: true },
    GtkPopoverMenuBar: { menuHost: true },
    AdwNavigationView: {
        navigationPages: [{ sub: "Page", forValue: "AdwNavigationView", props: "NavigationViewPageProps" }],
    },
    AdwNavigationSplitView: {
        navigationPages: [{ sub: "Page", forValue: "AdwNavigationSplitView", props: "NavigationSplitViewPageProps" }],
    },
    GtkTextView: {
        virtualChildren: [
            { sub: "Tag", intrinsic: "TextTag", props: "TextTagProps" },
            { sub: "Anchor", intrinsic: "TextAnchor", props: "TextAnchorProps" },
            { sub: "Paintable", intrinsic: "TextPaintable", props: "TextPaintableProps" },
        ],
    },
    GtkSourceView: {
        virtualChildren: [
            { sub: "Tag", intrinsic: "TextTag", props: "TextTagProps" },
            { sub: "Anchor", intrinsic: "TextAnchor", props: "TextAnchorProps" },
            { sub: "Paintable", intrinsic: "TextPaintable", props: "TextPaintableProps" },
        ],
    },
};

export const getCompoundChildren = (jsxName: string): CompoundChildrenConfig | null => {
    return COMPOUND_CHILDREN[jsxName] ?? null;
};
