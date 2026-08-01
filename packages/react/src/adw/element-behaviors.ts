import type * as Gtk from "@gtkx/gi/gtk";
import * as Adw from "@gtkx/gi/adw";
import type { AlertDialogResponse } from "./prop-types.js";
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
import { type ElementConfig, forTypes, registerElements } from "../reconciler/registry.js";
import { BUILTIN_ELEMENTS, CHILD_SETTER_TYPES, CONTENT_SETTER_TYPES } from "./element-config.js";

type AdwChildSetter =
    | Adw.Bin |
    Adw.BreakpointBin |
    Adw.Clamp |
    Adw.ClampScrollable |
    Adw.Dialog |
    Adw.NavigationPage |
    Adw.SplitButton |
    Adw.StatusPage |
    Adw.TabOverview |
    Adw.ToastOverlay |
    Adw.Toggle;

type AdwContentSetter = Adw.ApplicationWindow | Adw.BottomSheet | Adw.Flap | Adw.OverlaySplitView | Adw.Window;
type BreakpointHost = Adw.ApplicationWindow | Adw.Window | Adw.Dialog;
type PageHost = Adw.PreferencesDialog | Adw.PreferencesWindow;
type PrefixSuffixRow = Adw.ActionRow | Adw.EntryRow | Adw.ExpanderRow;

const childSetter = childSetterSlot<AdwChildSetter>();
const contentSetter = contentSetterSlot<AdwContentSetter>();

const breakpoints = slot<BreakpointHost, Adw.Breakpoint>("breakpoints", "AdwBreakpoint", {
    attach: (host, breakpoint) => {
        host.addBreakpoint(breakpoint);
    },
});

const prefixSuffix = [
    slot<PrefixSuffixRow, Gtk.Widget>("prefix", "GtkWidget", {
        attach: (row, child) => {
            row.addPrefix(child);
        },
        detach: (row, child) => {
            row.remove(child);
        },
    }),
    slot<PrefixSuffixRow, Gtk.Widget>("suffix", "GtkWidget", {
        attach: (row, child) => {
            row.addSuffix(child);
        },
        detach: (row, child) => {
            row.remove(child);
        },
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

const BUILTIN_BEHAVIORS: Record<string, ElementConfig<never>> = {
    ...forTypes(CHILD_SETTER_TYPES, {
        behaviors: [childSetter],
    }),
    ...forTypes(CONTENT_SETTER_TYPES, {
        behaviors: [contentSetter],
    }),
    AdwDialog: {
        behaviors: [childSetter, breakpoints],
    },
    AdwApplicationWindow: {
        behaviors: [contentSetter, breakpoints],
    },
    AdwWindow: {
        behaviors: [contentSetter, breakpoints],
    },
    AdwBreakpointBin: {
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
    AdwActionRow: {
        behaviors: prefixSuffix,
    },
    AdwEntryRow: {
        behaviors: prefixSuffix,
    },
    AdwExpanderRow: {
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
        behaviors: [contentSetterSlot<Adw.NavigationSplitView, Adw.NavigationPage>("AdwNavigationPage")],
    },
    AdwLeaflet: {
        behaviors: [boxSlot<Adw.Leaflet | Adw.WrapBox>()],
    },
    AdwWrapBox: {
        behaviors: [boxSlot<Adw.Leaflet | Adw.WrapBox>()],
    },
    AdwCarousel: {
        behaviors: [
            slot<Adw.Carousel, Gtk.Widget>("children", "GtkWidget", {
                attach: (carousel, child, info) => {
                    carousel.insert(child, info.index);
                },
                detach: (carousel, child) => {
                    carousel.remove(child);
                },
                reorder: (carousel, child, info) => {
                    carousel.reorder(child, info.index);
                },
            }),
        ],
    },
    AdwPreferencesPage: {
        behaviors: [
            slot<Adw.PreferencesPage, Adw.PreferencesGroup>("children", "AdwPreferencesGroup", {
                attach: (page, group, info) => {
                    page.insert(group, info.index);
                },
                detach: (page, group) => {
                    page.remove(group);
                },
            }),
        ],
    },
    AdwPreferencesDialog: {
        behaviors: [pageHostChildren],
    },
    AdwPreferencesWindow: {
        behaviors: [pageHostChildren],
    },
    AdwPreferencesGroup: {
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
        behaviors: [
            slot<Adw.TabView, Gtk.Widget>("children", "GtkWidget", {
                attach: (view, child, info) => view.insert(child, info.index),
                reorder: (view, _child, info) => {
                    if (info.adopted instanceof Adw.TabPage) {
                        view.reorderPage(info.adopted, info.index);
                    }
                },
                detach: (view, _child, info) => {
                    if (info.adopted instanceof Adw.TabPage) {
                        view.closePage(info.adopted);
                    }
                },
                resolve: (view, child) => view.getPage(child),
            }),
        ],
    },
    AdwNavigationView: {
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
        behaviors: [
            contentSetterSlot<Adw.ToolbarView>(),
            slot<Adw.ToolbarView, Gtk.Widget>("topBar", "GtkWidget", {
                attach: (view, child) => {
                    view.addTopBar(child);
                },
                detach: (view, child) => {
                    view.remove(child);
                },
            }),
            slot<Adw.ToolbarView, Gtk.Widget>("bottomBar", "GtkWidget", {
                attach: (view, child) => {
                    view.addBottomBar(child);
                },
                detach: (view, child) => {
                    view.remove(child);
                },
            }),
        ],
    },
    AdwHeaderBar: {
        behaviors: [
            slot<Adw.HeaderBar, Gtk.Widget>("start", "GtkWidget", {
                attach: (bar, child) => {
                    bar.packStart(child);
                },
                detach: (bar, child) => {
                    bar.remove(child);
                },
            }),
            slot<Adw.HeaderBar, Gtk.Widget>("end", "GtkWidget", {
                attach: (bar, child) => {
                    bar.packEnd(child);
                },
                detach: (bar, child) => {
                    bar.remove(child);
                },
            }),
        ],
    },
    AdwShortcutsDialog: {
        behaviors: [
            slot<Adw.ShortcutsDialog, Adw.ShortcutsSection>("children", "AdwShortcutsSection", {
                attach: (dialog, section) => {
                    dialog.add(section);
                },
            }),
        ],
    },
    AdwShortcutsSection: {
        behaviors: [
            slot<Adw.ShortcutsSection, Adw.ShortcutsItem>("children", "AdwShortcutsItem", {
                attach: (section, item) => {
                    section.add(item);
                },
            }),
        ],
    },
    AdwToggleGroup: {
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
        behaviors: [
            list<Adw.AlertDialog, AlertDialogResponse>("responses", {
                add: (dialog, response) => {
                    dialog.addResponse(response.id, response.label);

                    if (response.appearance !== undefined) {
                        dialog.setResponseAppearance(response.id, response.appearance);
                    }

                    if (response.isEnabled !== undefined) {
                        dialog.setResponseEnabled(response.id, response.isEnabled);
                    }
                },
                remove: (dialog, response) => {
                    dialog.removeResponse(response.id);
                },
            }),
        ],
    },
};

registerElements(BUILTIN_ELEMENTS);
registerElements(BUILTIN_BEHAVIORS);
