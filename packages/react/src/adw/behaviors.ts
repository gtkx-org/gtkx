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
    registerElementBehaviors,
    slot,
} from "../reconciler/behaviors.js";
import { registerLazyElements } from "../reconciler/lazy-elements.js";
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

const childSetter = childSetterSlot<AdwChildSetter>();

const contentSetter = contentSetterSlot<AdwContentSetter>();

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

const ADW_BEHAVIORS = {
    AdwBin: [childSetter],
    AdwClamp: [childSetter],
    AdwClampScrollable: [childSetter],
    AdwNavigationPage: [childSetter],
    AdwSplitButton: [childSetter],
    AdwStatusPage: [childSetter],
    AdwTabOverview: [childSetter],
    AdwToastOverlay: [childSetter],
    AdwToggle: [childSetter],
    AdwBottomSheet: [contentSetter],
    AdwFlap: [contentSetter],
    AdwOverlaySplitView: [contentSetter],
    AdwDialog: [childSetter, breakpoints],
    AdwApplicationWindow: [contentSetter, breakpoints],
    AdwWindow: [contentSetter, breakpoints],
    AdwBreakpointBin: [
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
    AdwActionRow: prefixSuffix,
    AdwEntryRow: prefixSuffix,
    AdwExpanderRow: [
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
    AdwNavigationSplitView: [contentSetterSlot<Adw.NavigationSplitView, Adw.NavigationPage>("AdwNavigationPage")],
    AdwLeaflet: [boxSlot<Adw.Leaflet | Adw.WrapBox>()],
    AdwWrapBox: [boxSlot<Adw.Leaflet | Adw.WrapBox>()],
    AdwCarousel: [
        slot<Adw.Carousel, Gtk.Widget>("children", "GtkWidget", {
            attach: (carousel, child, info) => carousel.insert(child, info.index),
            detach: (carousel, child) => carousel.remove(child),
            reorder: (carousel, child, info) => carousel.reorder(child, info.index),
        }),
    ],
    AdwPreferencesPage: [
        slot<Adw.PreferencesPage, Adw.PreferencesGroup>("children", "AdwPreferencesGroup", {
            attach: (page, group, info) => page.insert(group, info.index),
            detach: (page, group) => page.remove(group),
        }),
    ],
    AdwPreferencesDialog: [pageHostChildren],
    AdwPreferencesWindow: [pageHostChildren],
    AdwPreferencesGroup: [
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
    AdwSqueezer: [
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
    AdwTabView: [
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
    AdwNavigationView: [
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
    AdwViewStack: [
        adoptedChildrenSlot<Adw.ViewStack, Gtk.Widget>(
            "GtkWidget",
            (stack, child) => stack.add(child),
            (stack, child) => {
                stack.remove(child);
            },
        ),
        deferred<Adw.ViewStack, string>("visibleChildName", (stack, name) => stack.getChildByName(name) !== null),
    ],
    AdwToolbarView: [
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
    AdwHeaderBar: [
        slot<Adw.HeaderBar, Gtk.Widget>("start", "GtkWidget", {
            attach: (bar, child) => bar.packStart(child),
            detach: (bar, child) => bar.remove(child),
        }),
        slot<Adw.HeaderBar, Gtk.Widget>("end", "GtkWidget", {
            attach: (bar, child) => bar.packEnd(child),
            detach: (bar, child) => bar.remove(child),
        }),
    ],
    AdwShortcutsDialog: [
        slot<Adw.ShortcutsDialog, Adw.ShortcutsSection>("children", "AdwShortcutsSection", {
            attach: (dialog, section) => dialog.add(section),
        }),
    ],
    AdwShortcutsSection: [
        slot<Adw.ShortcutsSection, Adw.ShortcutsItem>("children", "AdwShortcutsItem", {
            attach: (section, item) => section.add(item),
        }),
    ],
    AdwToggleGroup: [
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
    AdwAlertDialog: [
        list<Adw.AlertDialog, AlertDialogResponse>("responses", {
            add: (dialog, response) => {
                dialog.addResponse(response.id, response.label);
                if (response.appearance !== undefined) dialog.setResponseAppearance(response.id, response.appearance);
                if (response.enabled !== undefined) dialog.setResponseEnabled(response.id, response.enabled);
            },
            remove: (dialog, response) => dialog.removeResponse(response.id),
        }),
    ],
};

let registered = false;

export const registerAdwBehaviors = (): void => {
    if (registered) return;
    registered = true;
    registerLazyElements(["AdwViewStackPage", "AdwTabPage"]);
    registerElementBehaviors(ADW_BEHAVIORS);
};
