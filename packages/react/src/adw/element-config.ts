import { type ElementConfig, forTypes, internal, type ModuleExport } from "../reconciler/registry.js";

const CHILD_SETTER_TYPES: string[] = [
    "AdwBin",
    "AdwClamp",
    "AdwClampScrollable",
    "AdwNavigationPage",
    "AdwSplitButton",
    "AdwStatusPage",
    "AdwTabOverview",
    "AdwToastOverlay",
    "AdwToggle",
];

const CONTENT_SETTER_TYPES: string[] = ["AdwBottomSheet", "AdwFlap", "AdwOverlaySplitView"];
const childrenProps = internal("ChildrenProps");
const breakpointsProps = adw("AdwBreakpointsProps");
const preferencesRowProps = adw("AdwPreferencesRowProps");

/**
 * The static, runtime-free half of the built-in element configuration: which base props interface each
 * generated element extends, which component wraps it, and whether its GObject is created lazily by its
 * parent. Codegen imports this module, so it must never reach the GObject bindings.
 */
const BUILTIN_ELEMENTS: Record<string, ElementConfig> = {
    ...forTypes(CHILD_SETTER_TYPES, {
        props: childrenProps,
        omittedProps: ["child"],
    }),
    ...forTypes(CONTENT_SETTER_TYPES, {
        props: childrenProps,
        omittedProps: ["content"],
    }),
    AdwViewStackPage: {
        lazy: true,
    },
    AdwTabPage: {
        lazy: true,
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
    AdwLeaflet: {
        props: childrenProps,
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
    AdwPreferencesWindow: {
        props: childrenProps,
    },
    AdwPreferencesGroup: {
        props: childrenProps,
    },
    AdwSqueezer: {
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
    },
};

function adw(name: string): ModuleExport {
    return { module: "@gtkx/react/adw", export: name };
}

export { CHILD_SETTER_TYPES, CONTENT_SETTER_TYPES, BUILTIN_ELEMENTS };
