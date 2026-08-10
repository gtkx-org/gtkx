import { type ElementConfig, forTypes, internal, type ModuleExport } from "../reconciler/registry.js";

const CHILD_SETTER_TYPES: string[] = [
    "AdwBin",
    "AdwClamp",
    "AdwNavigationPage",
    "AdwSplitButton",
    "AdwStatusPage",
    "AdwTabOverview",
    "AdwToastOverlay",
    "AdwToggle",
];

const CONTENT_SETTER_TYPES: string[] = ["AdwBottomSheet", "AdwOverlaySplitView"];
const childrenProps = internal("ChildrenProps");
const breakpointsProps = adw("AdwBreakpointsProps");
const preferencesRowProps = adw("AdwPreferencesRowProps");

const BUILTIN_ELEMENTS: Record<string, ElementConfig> = {
    ...forTypes(CHILD_SETTER_TYPES, {
        props: childrenProps,
        omittedProps: ["child"],
    }),
    ...forTypes(CONTENT_SETTER_TYPES, {
        props: childrenProps,
        omittedProps: ["content"],
    }),
    AdwClampScrollable: {
        props: childrenProps,
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
    AdwSidebarSection: {
        props: childrenProps,
    },
    AdwMultiLayoutView: {
        props: adw("AdwMultiLayoutViewProps"),
    },
    AdwPreferencesRow: {
        props: preferencesRowProps,
    },
    AdwDialog: {
        props: breakpointsProps,
        component: adw("createDialogComponent"),
        omittedProps: ["child"],
    },
    AdwApplicationWindow: {
        props: breakpointsProps,
        omittedProps: ["content"],
    },
    AdwWindow: {
        props: breakpointsProps,
        omittedProps: ["content"],
    },
    AdwBreakpointBin: {
        props: breakpointsProps,
        omittedProps: ["child"],
    },
    AdwActionRow: {
        props: preferencesRowProps,
    },
    AdwEntryRow: {
        props: preferencesRowProps,
    },
    AdwExpanderRow: {
        props: adw("AdwExpanderRowProps"),
    },
    AdwNavigationSplitView: {
        props: childrenProps,
        omittedProps: ["content"],
    },
    AdwWrapBox: {
        props: childrenProps,
    },
    AdwCarousel: {
        props: childrenProps,
    },
    AdwPreferencesPage: {
        props: childrenProps,
    },
    AdwPreferencesDialog: {
        props: childrenProps,
    },
    AdwPreferencesGroup: {
        props: childrenProps,
    },
    AdwTabView: {
        props: childrenProps,
    },
    AdwNavigationView: {
        props: childrenProps,
    },
    AdwViewStack: {
        props: childrenProps,
    },
    AdwToolbarView: {
        props: adw("AdwToolbarViewProps"),
        omittedProps: ["content"],
    },
    AdwHeaderBar: {
        props: internal("GtkHeaderBarProps"),
    },
    AdwShortcutsDialog: {
        props: childrenProps,
    },
    AdwShortcutsSection: {
        props: childrenProps,
    },
    AdwToggleGroup: {
        props: childrenProps,
    },
    AdwAlertDialog: {
        props: adw("AdwAlertDialogProps"),
        omittedProps: ["extraChild"],
    },
};

function adw(name: string): ModuleExport {
    return { module: "@gtkx/react/adw", export: name };
}

export { CHILD_SETTER_TYPES, CONTENT_SETTER_TYPES, BUILTIN_ELEMENTS };
