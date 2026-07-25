import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import {
    addRemoveSlot,
    adoptedChildrenSlot,
    boxSlot,
    childSetterSlot,
    contentSetterSlot,
    deferred,
    list,
    slot,
} from "../reconciler/behaviors.js";
import { type ElementConfig, type ModuleExport, registerElements } from "../reconciler/registry.js";
import type { AlertDialogResponse } from "./prop-types.js";

type AdwChildSetter =
    | Adw.Bin
    | Adw.BreakpointBin
    | Adw.Clamp
    | Adw.ClampScrollable
    | Adw.Dialog
    | Adw.NavigationPage
    | Adw.SplitButton
    | Adw.StatusPage
    | Adw.TabOverview
    | Adw.ToastOverlay
    | Adw.Toggle;

type AdwContentSetter = Adw.ApplicationWindow | Adw.BottomSheet | Adw.Flap | Adw.OverlaySplitView | Adw.Window;
type BreakpointHost = Adw.ApplicationWindow | Adw.Window | Adw.Dialog;
type PageHost = Adw.PreferencesDialog | Adw.PreferencesWindow;
type PrefixSuffixRow = Adw.ActionRow | Adw.EntryRow | Adw.ExpanderRow;

const internal = (name: string): ModuleExport => ({ module: "@gtkx/react/internal", export: name });
const adw = (name: string): ModuleExport => ({ module: "@gtkx/react/adw", export: name });
const childrenProps = internal("ChildrenProps");
const childSetter = childSetterSlot<AdwChildSetter>();
const contentSetter = contentSetterSlot<AdwContentSetter>();
const breakpointsProps = adw("AdwBreakpointsProps");
const preferencesRowProps = adw("AdwPreferencesRowProps");

const breakpoints = slot<BreakpointHost, Adw.Breakpoint>("breakpoints", "AdwBreakpoint", {
    attach: (host, breakpoint) => host.addBreakpoint(breakpoint),
});

const prefixSuffix = [
    slot<PrefixSuffixRow, Gtk.Widget>("prefix", "GtkWidget", {
        attach: (row, child) => row.addPrefix(child),
        detach: (row, child) => row.remove(child),
    }),
    slot<PrefixSuffixRow, Gtk.Widget>("suffix", "GtkWidget", {
        attach: (row, child) => row.addSuffix(child),
        detach: (row, child) => row.remove(child),
    }),
];

const pageHostChildren = addRemoveSlot<Adw.PreferencesPage, PageHost>(
    "children",
    "AdwPreferencesPage",
    (host, page) => {
        host.add(page);
    },
    (host, page) => {
        host.remove(page);
    },
);

export const BUILTIN_ELEMENTS: Record<string, ElementConfig> = {
    AdwBin: { props: childrenProps, behaviors: [childSetter] },
    AdwClamp: { props: childrenProps, behaviors: [childSetter] },
    AdwClampScrollable: { props: childrenProps, behaviors: [childSetter] },
    AdwNavigationPage: { props: childrenProps, behaviors: [childSetter] },
    AdwSplitButton: { props: childrenProps, behaviors: [childSetter] },
    AdwStatusPage: { props: childrenProps, behaviors: [childSetter] },
    AdwTabOverview: { props: childrenProps, behaviors: [childSetter] },
    AdwToastOverlay: { props: childrenProps, behaviors: [childSetter] },
    AdwToggle: { props: childrenProps, behaviors: [childSetter] },
    AdwBottomSheet: { props: childrenProps, behaviors: [contentSetter] },
    AdwFlap: { props: childrenProps, behaviors: [contentSetter] },
    AdwOverlaySplitView: { props: childrenProps, behaviors: [contentSetter] },
    AdwViewStackPage: { lazy: true },
    AdwTabPage: { lazy: true },
    AdwPreferencesRow: { props: preferencesRowProps },
    AdwDialog: {
        props: breakpointsProps,
        component: adw("createDialogComponent"),
        behaviors: [childSetter, breakpoints],
    },
    AdwApplicationWindow: { props: breakpointsProps, behaviors: [contentSetter, breakpoints] },
    AdwWindow: { props: breakpointsProps, behaviors: [contentSetter, breakpoints] },
    AdwBreakpointBin: {
        props: breakpointsProps,
        behaviors: [
            childSetter,
            addRemoveSlot<Adw.Breakpoint, Adw.BreakpointBin>(
                "breakpoints",
                "AdwBreakpoint",
                (bin, breakpoint) => {
                    bin.addBreakpoint(breakpoint);
                },
                (bin, breakpoint) => {
                    bin.removeBreakpoint(breakpoint);
                },
            ),
        ],
    },
    AdwActionRow: { props: preferencesRowProps, behaviors: prefixSuffix },
    AdwEntryRow: { props: preferencesRowProps, behaviors: prefixSuffix },
    AdwExpanderRow: {
        props: adw("AdwExpanderRowProps"),
        behaviors: [
            ...prefixSuffix,
            addRemoveSlot<Gtk.Widget, Adw.ExpanderRow>(
                "rows",
                "GtkWidget",
                (row, child) => {
                    row.addRow(child);
                },
                (row, child) => {
                    row.remove(child);
                },
            ),
            addRemoveSlot<Gtk.Widget, Adw.ExpanderRow>(
                "actions",
                "GtkWidget",
                (row, child) => {
                    row.addAction(child);
                },
                (row, child) => {
                    row.remove(child);
                },
            ),
        ],
    },
    AdwNavigationSplitView: {
        props: childrenProps,
        behaviors: [contentSetterSlot<Adw.NavigationSplitView, Adw.NavigationPage>("AdwNavigationPage")],
    },
    AdwLeaflet: { props: childrenProps, behaviors: [boxSlot<Adw.Leaflet | Adw.WrapBox>()] },
    AdwWrapBox: { props: childrenProps, behaviors: [boxSlot<Adw.Leaflet | Adw.WrapBox>()] },
    AdwCarousel: {
        props: childrenProps,
        behaviors: [
            slot<Adw.Carousel, Gtk.Widget>("children", "GtkWidget", {
                attach: (carousel, child, info) => carousel.insert(child, info.index),
                detach: (carousel, child) => carousel.remove(child),
                reorder: (carousel, child, info) => carousel.reorder(child, info.index),
            }),
        ],
    },
    AdwPreferencesPage: {
        props: childrenProps,
        behaviors: [
            slot<Adw.PreferencesPage, Adw.PreferencesGroup>("children", "AdwPreferencesGroup", {
                attach: (page, group, info) => page.insert(group, info.index),
                detach: (page, group) => page.remove(group),
            }),
        ],
    },
    AdwPreferencesDialog: { props: childrenProps, behaviors: [pageHostChildren] },
    AdwPreferencesWindow: { props: childrenProps, behaviors: [pageHostChildren] },
    AdwPreferencesGroup: {
        props: childrenProps,
        behaviors: [
            addRemoveSlot<Gtk.Widget, Adw.PreferencesGroup>(
                "children",
                "GtkWidget",
                (group, child) => {
                    group.add(child);
                },
                (group, child) => {
                    group.remove(child);
                },
            ),
        ],
    },
    AdwSqueezer: {
        props: childrenProps,
        behaviors: [
            addRemoveSlot<Gtk.Widget, Adw.Squeezer>(
                "children",
                "GtkWidget",
                (squeezer, child) => {
                    squeezer.add(child);
                },
                (squeezer, child) => {
                    squeezer.remove(child);
                },
            ),
        ],
    },
    AdwTabView: {
        props: childrenProps,
        behaviors: [
            slot<Adw.TabView, Gtk.Widget>("children", "GtkWidget", {
                attach: (view, child, info) => view.insert(child, info.index),
                reorder: (view, _child, info) => {
                    if (info.adopted instanceof Adw.TabPage) view.reorderPage(info.adopted, info.index);
                },
                detach: (view, _child, info) => {
                    if (info.adopted instanceof Adw.TabPage) view.closePage(info.adopted);
                },
                resolve: (view, child) => view.getPage(child),
            }),
        ],
    },
    AdwNavigationView: {
        props: childrenProps,
        behaviors: [
            addRemoveSlot<Adw.NavigationPage, Adw.NavigationView>(
                "children",
                "AdwNavigationPage",
                (view, page) => {
                    view.add(page);
                },
                (view, page) => {
                    view.remove(page);
                },
            ),
        ],
    },
    AdwViewStack: {
        props: childrenProps,
        behaviors: [
            adoptedChildrenSlot<Adw.ViewStack, Gtk.Widget>(
                "GtkWidget",
                (stack, child) => stack.add(child),
                (stack, child) => {
                    stack.remove(child);
                },
            ),
            deferred<Adw.ViewStack, string>("visibleChildName", (stack, name) => stack.getChildByName(name) !== null),
        ],
    },
    AdwToolbarView: {
        props: adw("AdwToolbarViewProps"),
        behaviors: [
            contentSetterSlot<Adw.ToolbarView>(),
            slot<Adw.ToolbarView, Gtk.Widget>("topBar", "GtkWidget", {
                attach: (view, child) => view.addTopBar(child),
                detach: (view, child) => view.remove(child),
            }),
            slot<Adw.ToolbarView, Gtk.Widget>("bottomBar", "GtkWidget", {
                attach: (view, child) => view.addBottomBar(child),
                detach: (view, child) => view.remove(child),
            }),
        ],
    },
    AdwHeaderBar: {
        props: internal("GtkHeaderBarProps"),
        behaviors: [
            slot<Adw.HeaderBar, Gtk.Widget>("start", "GtkWidget", {
                attach: (bar, child) => bar.packStart(child),
                detach: (bar, child) => bar.remove(child),
            }),
            slot<Adw.HeaderBar, Gtk.Widget>("end", "GtkWidget", {
                attach: (bar, child) => bar.packEnd(child),
                detach: (bar, child) => bar.remove(child),
            }),
        ],
    },
    AdwShortcutsDialog: {
        props: childrenProps,
        behaviors: [
            slot<Adw.ShortcutsDialog, Adw.ShortcutsSection>("children", "AdwShortcutsSection", {
                attach: (dialog, section) => dialog.add(section),
            }),
        ],
    },
    AdwShortcutsSection: {
        props: childrenProps,
        behaviors: [
            slot<Adw.ShortcutsSection, Adw.ShortcutsItem>("children", "AdwShortcutsItem", {
                attach: (section, item) => section.add(item),
            }),
        ],
    },
    AdwToggleGroup: {
        props: childrenProps,
        behaviors: [
            addRemoveSlot<Adw.Toggle, Adw.ToggleGroup>(
                "children",
                "AdwToggle",
                (group, toggle) => {
                    group.add(toggle);
                },
                (group, toggle) => {
                    group.remove(toggle);
                },
            ),
            deferred<Adw.ToggleGroup, string>("activeName", (group, name) => group.getToggleByName(name) !== null),
            deferred("active"),
        ],
    },
    AdwAlertDialog: {
        props: adw("AdwAlertDialogProps"),
        behaviors: [
            list<Adw.AlertDialog, AlertDialogResponse>("responses", {
                add: (dialog, response) => {
                    dialog.addResponse(response.id, response.label);
                    if (response.appearance !== undefined) {
                        dialog.setResponseAppearance(response.id, response.appearance);
                    }
                    if (response.enabled !== undefined) dialog.setResponseEnabled(response.id, response.enabled);
                },
                remove: (dialog, response) => dialog.removeResponse(response.id),
            }),
        ],
    },
};

registerElements(BUILTIN_ELEMENTS);
