import { type ElementConfig, forTypes, internal } from "./reconciler/registry.js";

const SINGLE_CHILD_TYPES: string[] = [
    "GtkAspectFrame",
    "GtkButton",
    "GtkCheckButton",
    "GtkComboBox",
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
 * The static, runtime-free half of the built-in element configuration: which base props interface each
 * generated element extends, which component wraps it, and whether its GObject is created lazily by its
 * parent. Codegen imports this module, so it must never reach the GObject bindings.
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
        lazy: true,
    },
    GtkFixedLayoutChild: {
        lazy: true,
    },
    GtkOverlayLayoutChild: {
        lazy: true,
    },
    GtkStackPage: {
        lazy: true,
    },
    GtkNotebookPage: {
        lazy: true,
    },
    GActionGroup: {
        props: internal("GActionGroupProps"),
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
        props: internal("GActionMapProps"),
    },
    GMenu: {
        props: internal("GMenuProps"),
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
