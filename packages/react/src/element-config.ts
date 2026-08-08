import { type ElementConfig, forTypes, internal } from "./reconciler/registry.js";

const SINGLE_CHILD_TYPES: string[] = [
    "GtkAspectFrame",
    "GtkButton",
    "GtkCheckButton",
    "GtkDragIcon",
    "GtkExpander",
    "GtkFlowBoxChild",
    "GtkFrame",
    "GtkGraphicsOffload",
    "GtkListBoxRow",
    "GtkListHeader",
    "GtkListItem",
    "GtkMenuButton",
    "GtkPopover",
    "GtkPopoverBin",
    "GtkRevealer",
    "GtkScrolledWindow",
    "GtkSearchBar",
    "GtkTreeExpander",
    "GtkViewport",
    "GtkWindowHandle",
];

/**
 * The framework's own element configuration for the GTK types it customizes: the base props interface each
 * generated element extends, the component that wraps it, the GObject properties left out of its generated
 * props, and whether its GObject is created by its parent. Carries no behaviors, so importing it never
 * reaches the GObject bindings.
 */
const BUILTIN_ELEMENTS: Record<string, ElementConfig> = {
    ...forTypes(SINGLE_CHILD_TYPES, {
        props: internal("ChildrenProps"),
        omittedProps: ["child"],
    }),
    ...forTypes(["GtkHeaderBar", "GtkActionBar"], {
        props: internal("GtkHeaderBarProps"),
    }),
    GtkWindow: {
        props: internal("ChildrenProps"),
        component: internal("createWindowComponent"),
        omittedProps: ["child"],
    },
    GtkApplicationWindow: {
        component: internal("createApplicationWindowComponent"),
    },
    GtkLabel: {
        props: internal("ChildrenProps"),
    },
    GtkTextBuffer: {
        props: internal("ChildrenProps"),
    },
    GtkTextTag: {
        props: internal("ChildrenProps"),
    },
    GtkTextChildAnchor: {
        props: internal("GtkTextChildAnchorProps"),
    },
    GtkGridLayoutChild: {
        isLazy: true,
    },
    GtkFixedLayoutChild: {
        isLazy: true,
    },
    GtkOverlayLayoutChild: {
        isLazy: true,
    },
    GtkStackPage: {
        isLazy: true,
    },
    GtkNotebookPage: {
        isLazy: true,
    },
    GActionGroup: {
        props: internal("ActionGroupProps"),
    },
    GtkWidget: {
        props: internal("GtkWidgetProps"),
    },
    GtkBox: {
        props: internal("ChildrenProps"),
    },
    GtkListBox: {
        props: internal("ChildrenProps"),
    },
    GtkFlowBox: {
        props: internal("ChildrenProps"),
    },
    GtkOverlay: {
        props: internal("GtkOverlayProps"),
        omittedProps: ["child"],
    },
    GtkShortcutController: {
        props: internal("GtkShortcutControllerProps"),
    },
    GtkTextView: {
        props: internal("ChildrenProps"),
    },
    GActionMap: {
        props: internal("ActionMapProps"),
    },
    GMenu: {
        props: internal("MenuProps"),
    },
    GtkColumnView: {
        props: internal("ChildrenProps"),
    },
    GtkGrid: {
        props: internal("ChildrenProps"),
    },
    GtkFixed: {
        props: internal("ChildrenProps"),
    },
    GtkSizeGroup: {
        props: internal("GtkSizeGroupProps"),
        component: internal("createPortaledComponent"),
    },
    GtkConstraintLayout: {
        props: internal("GtkConstraintLayoutProps"),
    },
    GtkStack: {
        props: internal("ChildrenProps"),
    },
    GtkNotebook: {
        props: internal("ChildrenProps"),
    },
    GtkApplication: {
        props: internal("GtkApplicationProps"),
        component: internal("createApplicationComponent"),
    },
    GtkAboutDialog: {
        props: internal("GtkAboutDialogProps"),
    },
    GtkScale: {
        props: internal("GtkScaleProps"),
    },
    GtkCalendar: {
        props: internal("GtkCalendarProps"),
    },
    GtkLevelBar: {
        props: internal("GtkLevelBarProps"),
    },
    GtkDropTarget: {
        props: internal("GtkDropTargetProps"),
    },
    GtkDrawingArea: {
        props: internal("GtkDrawingAreaProps"),
    },
    GtkDragSource: {
        props: internal("GtkDragSourceProps"),
    },
};

export { SINGLE_CHILD_TYPES, BUILTIN_ELEMENTS };
