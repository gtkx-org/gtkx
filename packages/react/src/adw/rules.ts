import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import {
    addRemoveBehavior,
    adoptedChildrenRule,
    boxBehavior,
    type ContainerBehavior,
    childSetterBehavior,
    containerRule,
    contentSetterBehavior,
    indexedBehavior,
    lazyRule,
    listRule,
    registerElementProps,
} from "../reconciler/element-rules.js";
import type { AlertDialogResponse } from "./element-props.js";

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

const childSetter = containerRule<AdwChildSetter, Gtk.Widget>("children", "GtkWidget", {
    behavior: childSetterBehavior<AdwChildSetter>(),
});

const contentSetter = containerRule<AdwContentSetter, Gtk.Widget>("children", "GtkWidget", {
    behavior: contentSetterBehavior<AdwContentSetter>(),
});

const breakpoints = containerRule<BreakpointHost, Adw.Breakpoint>("breakpoints", "AdwBreakpoint", {
    behavior: { attach: (host, breakpoint) => host.addBreakpoint(breakpoint) },
});

const rowSlot = (
    add: (row: PrefixSuffixRow, child: Gtk.Widget) => void,
): ContainerBehavior<PrefixSuffixRow, Gtk.Widget> =>
    addRemoveBehavior(add, (row, child) => {
        row.remove(child);
    });

const toolbarSlot = (add: (view: Adw.ToolbarView, child: Gtk.Widget) => void) =>
    addRemoveBehavior(add, (view: Adw.ToolbarView, child: Gtk.Widget) => {
        view.remove(child);
    });

const headerBarSlot = (pack: (bar: Adw.HeaderBar, child: Gtk.Widget) => void) =>
    addRemoveBehavior(pack, (bar: Adw.HeaderBar, child: Gtk.Widget) => {
        bar.remove(child);
    });

const prefixSuffix = [
    containerRule<PrefixSuffixRow, Gtk.Widget>("prefix", "GtkWidget", {
        behavior: rowSlot((row, child) => {
            row.addPrefix(child);
        }),
    }),
    containerRule<PrefixSuffixRow, Gtk.Widget>("suffix", "GtkWidget", {
        behavior: rowSlot((row, child) => {
            row.addSuffix(child);
        }),
    }),
];

const pageHostChildren = containerRule<PageHost, Adw.PreferencesPage>("children", "AdwPreferencesPage", {
    behavior: addRemoveBehavior(
        (host, page) => {
            host.add(page);
        },
        (host, page) => {
            host.remove(page);
        },
    ),
});

registerElementProps({
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
        containerRule<Adw.BreakpointBin, Adw.Breakpoint>("breakpoints", "AdwBreakpoint", {
            behavior: addRemoveBehavior(
                (bin, breakpoint) => {
                    bin.addBreakpoint(breakpoint);
                },
                (bin, breakpoint) => {
                    bin.removeBreakpoint(breakpoint);
                },
            ),
        }),
    ],
    AdwActionRow: prefixSuffix,
    AdwEntryRow: prefixSuffix,
    AdwExpanderRow: [
        ...prefixSuffix,
        containerRule<Adw.ExpanderRow, Gtk.Widget>("rows", "GtkWidget", {
            behavior: addRemoveBehavior(
                (row, child) => {
                    row.addRow(child);
                },
                (row, child) => {
                    row.remove(child);
                },
            ),
        }),
        containerRule<Adw.ExpanderRow, Gtk.Widget>("actions", "GtkWidget", {
            behavior: addRemoveBehavior(
                (row, child) => {
                    row.addAction(child);
                },
                (row, child) => {
                    row.remove(child);
                },
            ),
        }),
    ],
    AdwNavigationSplitView: [
        containerRule<Adw.NavigationSplitView, Adw.NavigationPage>("children", "AdwNavigationPage", {
            behavior: contentSetterBehavior<Adw.NavigationSplitView, Adw.NavigationPage>(),
        }),
    ],
    AdwLeaflet: [
        containerRule<Adw.Leaflet | Adw.WrapBox, Gtk.Widget>("children", "GtkWidget", {
            behavior: boxBehavior<Adw.Leaflet | Adw.WrapBox>(),
        }),
    ],
    AdwWrapBox: [
        containerRule<Adw.Leaflet | Adw.WrapBox, Gtk.Widget>("children", "GtkWidget", {
            behavior: boxBehavior<Adw.Leaflet | Adw.WrapBox>(),
        }),
    ],
    AdwCarousel: [
        containerRule<Adw.Carousel, Gtk.Widget>("children", "GtkWidget", {
            behavior: {
                ...indexedBehavior<Gtk.Widget, Adw.Carousel>(),
                reorder: (carousel, child, { index }) => carousel.reorder(child, index),
            },
        }),
    ],
    AdwPreferencesPage: [
        containerRule<Adw.PreferencesPage, Adw.PreferencesGroup>("children", "AdwPreferencesGroup", {
            behavior: {
                attach: (page, group) => page.add(group),
                detach: (page, group) => page.remove(group),
                insert: (page, group, { index }) => page.insert(group, index),
            },
        }),
    ],
    AdwPreferencesDialog: [pageHostChildren],
    AdwPreferencesWindow: [pageHostChildren],
    AdwPreferencesGroup: [
        containerRule<Adw.PreferencesGroup, Gtk.Widget>("children", "GtkWidget", {
            behavior: addRemoveBehavior(
                (group, child) => {
                    group.add(child);
                },
                (group, child) => {
                    group.remove(child);
                },
            ),
        }),
    ],
    AdwSqueezer: [
        containerRule<Adw.Squeezer, Gtk.Widget>("children", "GtkWidget", {
            behavior: addRemoveBehavior(
                (squeezer, child) => {
                    squeezer.add(child);
                },
                (squeezer, child) => {
                    squeezer.remove(child);
                },
            ),
        }),
    ],
    AdwTabView: [
        containerRule<Adw.TabView, Gtk.Widget>("children", "GtkWidget", {
            adopt: "resolve",
            behavior: {
                attach: (view, child) => view.append(child),
                insert: (view, child, { index }) => view.insert(child, index),
                reorder: (view, _child, { adopted, index }) => {
                    if (adopted instanceof Adw.TabPage) view.reorderPage(adopted, index);
                },
                detach: (view, _child, { adopted }) => {
                    if (adopted instanceof Adw.TabPage) view.closePage(adopted);
                },
                resolve: (view, child) => view.getPage(child),
            },
        }),
    ],
    AdwNavigationView: [
        containerRule<Adw.NavigationView, Adw.NavigationPage>("children", "AdwNavigationPage", {
            behavior: addRemoveBehavior(
                (view, page) => {
                    view.add(page);
                },
                (view, page) => {
                    view.remove(page);
                },
            ),
        }),
    ],
    AdwViewStack: [
        adoptedChildrenRule<Adw.ViewStack, Gtk.Widget>(
            "GtkWidget",
            (stack, child) => stack.add(child),
            (stack, child) => {
                stack.remove(child);
            },
        ),
        lazyRule<Adw.ViewStack, string>("visibleChildName", (stack, name) => stack.getChildByName(name) !== null),
    ],
    AdwToolbarView: [
        containerRule<Adw.ToolbarView, Gtk.Widget>("children", "GtkWidget", {
            behavior: contentSetterBehavior<Adw.ToolbarView>(),
        }),
        containerRule<Adw.ToolbarView, Gtk.Widget>("topBar", "GtkWidget", {
            behavior: toolbarSlot((view, child) => {
                view.addTopBar(child);
            }),
        }),
        containerRule<Adw.ToolbarView, Gtk.Widget>("bottomBar", "GtkWidget", {
            behavior: toolbarSlot((view, child) => {
                view.addBottomBar(child);
            }),
        }),
    ],
    AdwHeaderBar: [
        containerRule<Adw.HeaderBar, Gtk.Widget>("start", "GtkWidget", {
            behavior: headerBarSlot((bar, child) => {
                bar.packStart(child);
            }),
        }),
        containerRule<Adw.HeaderBar, Gtk.Widget>("end", "GtkWidget", {
            behavior: headerBarSlot((bar, child) => {
                bar.packEnd(child);
            }),
        }),
    ],
    AdwShortcutsDialog: [
        containerRule<Adw.ShortcutsDialog, Adw.ShortcutsSection>("children", "AdwShortcutsSection", {
            behavior: { attach: (dialog, section) => dialog.add(section) },
        }),
    ],
    AdwShortcutsSection: [
        containerRule<Adw.ShortcutsSection, Adw.ShortcutsItem>("children", "AdwShortcutsItem", {
            behavior: { attach: (section, item) => section.add(item) },
        }),
    ],
    AdwToggleGroup: [
        containerRule<Adw.ToggleGroup, Adw.Toggle>("children", "AdwToggle", {
            behavior: addRemoveBehavior(
                (group, toggle) => {
                    group.add(toggle);
                },
                (group, toggle) => {
                    group.remove(toggle);
                },
            ),
        }),
        lazyRule<Adw.ToggleGroup, string>("activeName", (group, name) => group.getToggleByName(name) !== null),
        lazyRule("active"),
    ],
    AdwAlertDialog: [
        listRule<Adw.AlertDialog, AlertDialogResponse>("responses", {
            add: (dialog, response) => {
                dialog.addResponse(response.id, response.label);
                if (response.appearance !== undefined) dialog.setResponseAppearance(response.id, response.appearance);
                if (response.enabled !== undefined) dialog.setResponseEnabled(response.id, response.enabled);
            },
            remove: (dialog, response) => dialog.removeResponse(response.id),
        }),
    ],
});
