/**
 * Virtual-child subcomponent mapping — JSX element name to the map of
 * subcomponent property → virtual JSX intrinsic name it routes through.
 *
 * For example `GtkConstraintLayout.Constraint` renders the
 * `<Constraint>` virtual intrinsic so the reconciler can attach a
 * GtkConstraint to the layout. Unlike container slots, virtual
 * subcomponents render an existing intrinsic element rather than
 * invoking a setter on the parent widget.
 *
 * The list is small and stable; defining it in code keeps the lookup
 * fast and avoids one more GIR-introspection pass.
 */
const VIRTUAL_SUBCOMPONENTS: Readonly<
    Record<string, ReadonlyArray<{ readonly child: string; readonly intrinsic: string }>>
> = Object.freeze({
    GtkShortcutController: [{ child: "Shortcut", intrinsic: "Shortcut" }],
    GtkConstraintLayout: [
        { child: "Constraint", intrinsic: "Constraint" },
        { child: "Guide", intrinsic: "ConstraintGuide" },
        { child: "Widget", intrinsic: "ConstraintLayoutWidget" },
        { child: "Vfl", intrinsic: "ConstraintVfl" },
    ],
    GtkStack: [{ child: "Page", intrinsic: "StackPage" }],
    AdwViewStack: [{ child: "Page", intrinsic: "StackPage" }],
    GtkNotebook: [
        { child: "Page", intrinsic: "NotebookPage" },
        { child: "PageTab", intrinsic: "NotebookPageTab" },
    ],
    GtkGrid: [{ child: "Child", intrinsic: "GridChild" }],
    GtkFixed: [{ child: "Child", intrinsic: "FixedChild" }],
    GtkOverlay: [{ child: "Child", intrinsic: "OverlayChild" }],
    GtkColumnView: [{ child: "Column", intrinsic: "ColumnViewColumn" }],
    GtkTextView: [
        { child: "Tag", intrinsic: "TextTag" },
        { child: "Anchor", intrinsic: "TextAnchor" },
        { child: "Paintable", intrinsic: "TextPaintable" },
    ],
    GtkSourceView: [
        { child: "Tag", intrinsic: "TextTag" },
        { child: "Anchor", intrinsic: "TextAnchor" },
        { child: "Paintable", intrinsic: "TextPaintable" },
    ],
    GtkMenuButton: [
        { child: "MenuItem", intrinsic: "MenuItem" },
        { child: "MenuSection", intrinsic: "MenuSection" },
        { child: "MenuSubmenu", intrinsic: "MenuSubmenu" },
    ],
    GtkPopoverMenu: [
        { child: "Item", intrinsic: "MenuItem" },
        { child: "Section", intrinsic: "MenuSection" },
        { child: "Submenu", intrinsic: "MenuSubmenu" },
    ],
    GtkPopoverMenuBar: [
        { child: "Item", intrinsic: "MenuItem" },
        { child: "Section", intrinsic: "MenuSection" },
        { child: "Submenu", intrinsic: "MenuSubmenu" },
    ],
});

/**
 * Returns the virtual-subcomponent record for a JSX element name, or an
 * empty array if no virtual subcomponents exist.
 *
 * @param jsxName - The JSX element name (PascalCase / GLib type name)
 */
export const virtualSubcomponentsFor = (
    jsxName: string,
): ReadonlyArray<{ readonly child: string; readonly intrinsic: string }> => VIRTUAL_SUBCOMPONENTS[jsxName] ?? [];
