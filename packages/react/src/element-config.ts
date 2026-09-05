import { type ElementConfig, forTypes, internal } from "./reconciler/registry.js";

const SINGLE_CHILD_TYPES: string[] = [
    "AdwBin",
    "AdwClamp",
    "AdwNavigationPage",
    "AdwSplitButton",
    "AdwStatusPage",
    "AdwTabOverview",
    "AdwToastOverlay",
    "AdwToggle",
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

const CONTENT_SETTER_TYPES: string[] = ["AdwBottomSheet", "AdwOverlaySplitView"];

const acceptedChildren = (
    acceptedChildTypes: string[],
    config: ElementConfig,
): ElementConfig => {
    const result = { ...config, acceptedChildTypes };

    return result;
};

/**
 * The framework's own element configuration for the Adwaita and GTK types it customizes: the base props interface each
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
        props: internal("GtkListBoxProps"),
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
    GtkTextView: acceptedChildren(["GtkTextBuffer"], {
        props: internal("ChildrenProps"),
    }),
    GActionMap: {
        props: internal("ActionMapProps"),
    },
    GMenu: {
        props: internal("MenuProps"),
    },
    GtkColumnView: acceptedChildren(["GtkColumnViewColumn"], {
        props: internal("ChildrenProps"),
    }),
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
    GtkApplication: acceptedChildren(["GtkWindow"], {
        props: internal("GtkApplicationProps"),
        component: internal("createApplicationComponent"),
    }),
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
    ...forTypes(CONTENT_SETTER_TYPES, {
        props: internal("ChildrenProps"),
        omittedProps: ["content"],
    }),
    AdwClampScrollable: {
        props: internal("ChildrenProps"),
        omittedProps: ["child"],
    },
    AdwViewStackPage: {
        isLazy: true,
    },
    AdwTabPage: {
        isLazy: true,
    },
    AdwLayout: {
        isLazy: true,
    },
    AdwSidebar: acceptedChildren(["AdwSidebarSection"], {
        props: internal("ChildrenProps"),
    }),
    AdwSidebarSection: acceptedChildren(["AdwSidebarItem"], {
        props: internal("ChildrenProps"),
    }),
    AdwMultiLayoutView: {
        props: internal("AdwMultiLayoutViewProps"),
    },
    AdwPreferencesRow: {
        props: internal("AdwPreferencesRowProps"),
    },
    AdwDialog: {
        props: internal("AdwBreakpointsProps"),
        component: internal("createDialogComponent"),
        omittedProps: ["child"],
    },
    AdwApplicationWindow: {
        props: internal("AdwBreakpointsProps"),
        omittedProps: ["content"],
    },
    AdwWindow: {
        props: internal("AdwBreakpointsProps"),
        omittedProps: ["content"],
    },
    AdwBreakpointBin: {
        props: internal("AdwBreakpointsProps"),
        omittedProps: ["child"],
    },
    AdwActionRow: {
        props: internal("AdwPreferencesRowProps"),
    },
    AdwEntryRow: {
        props: internal("AdwPreferencesRowProps"),
    },
    AdwExpanderRow: {
        props: internal("AdwExpanderRowProps"),
    },
    AdwNavigationSplitView: acceptedChildren(["AdwNavigationPage"], {
        props: internal("ChildrenProps"),
        omittedProps: ["content"],
    }),
    AdwWrapBox: {
        props: internal("ChildrenProps"),
    },
    AdwCarousel: {
        props: internal("ChildrenProps"),
    },
    AdwPreferencesPage: acceptedChildren(["AdwPreferencesGroup"], {
        props: internal("ChildrenProps"),
    }),
    AdwPreferencesDialog: acceptedChildren(["AdwPreferencesPage"], {
        props: internal("ChildrenProps"),
    }),
    AdwPreferencesGroup: {
        props: internal("ChildrenProps"),
    },
    AdwTabView: {
        props: internal("ChildrenProps"),
    },
    AdwNavigationView: acceptedChildren(["AdwNavigationPage"], {
        props: internal("ChildrenProps"),
    }),
    AdwViewStack: {
        props: internal("ChildrenProps"),
    },
    AdwToolbarView: {
        props: internal("AdwToolbarViewProps"),
        omittedProps: ["content"],
    },
    AdwHeaderBar: {
        props: internal("GtkHeaderBarProps"),
    },
    AdwShortcutsDialog: acceptedChildren(["AdwShortcutsSection"], {
        props: internal("ChildrenProps"),
    }),
    AdwShortcutsSection: acceptedChildren(["AdwShortcutsItem"], {
        props: internal("ChildrenProps"),
    }),
    AdwToggleGroup: acceptedChildren(["AdwToggle"], {
        props: internal("ChildrenProps"),
    }),
    AdwAlertDialog: {
        props: internal("AdwAlertDialogProps"),
        omittedProps: ["extraChild"],
    },
};

export { SINGLE_CHILD_TYPES, CONTENT_SETTER_TYPES, BUILTIN_ELEMENTS };
