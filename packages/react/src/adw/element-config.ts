import { type ElementConfig, internal, type ModuleExport } from "../reconciler/registry.js";

const childrenProps = internal("ChildrenProps");
const breakpointsProps = adw("AdwBreakpointsProps");
const preferencesRowProps = adw("AdwPreferencesRowProps");

/**
 * The static, runtime-free half of the built-in element configuration: which base props interface each
 * generated element extends, which component wraps it, and whether its GObject is created lazily by its
 * parent. Codegen imports this module, so it must never reach the GObject bindings.
 */
const BUILTIN_ELEMENTS: Record<string, ElementConfig> = {
    AdwBin: {
        props: childrenProps,
    },
    AdwClamp: {
        props: childrenProps,
    },
    AdwClampScrollable: {
        props: childrenProps,
    },
    AdwNavigationPage: {
        props: childrenProps,
    },
    AdwSplitButton: {
        props: childrenProps,
    },
    AdwStatusPage: {
        props: childrenProps,
    },
    AdwTabOverview: {
        props: childrenProps,
    },
    AdwToastOverlay: {
        props: childrenProps,
    },
    AdwToggle: {
        props: childrenProps,
    },
    AdwBottomSheet: {
        props: childrenProps,
    },
    AdwFlap: {
        props: childrenProps,
    },
    AdwOverlaySplitView: {
        props: childrenProps,
    },
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
    },
    AdwApplicationWindow: {
        props: breakpointsProps,
    },
    AdwWindow: {
        props: breakpointsProps,
    },
    AdwBreakpointBin: {
        props: breakpointsProps,
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

export { BUILTIN_ELEMENTS };
