import type * as Gtk from "@gtkx/gi/gtk";
import * as Adw from "@gtkx/gi/adw";
import type { AlertDialogResponse } from "./prop-types.js";
import {
    addRemoveSlot,
    adoptedChildrenSlot,
    applicationCreator,
    boxSlot,
    childMatcher,
    childSetterSlot,
    contentSetterSlot,
    deferred,
    indexedSlot,
    list,
    slot,
} from "../reconciler/behaviors.js";
import { type ElementBehavior, type ElementConfig, forTypes, registerElements } from "../reconciler/registry.js";
import { BUILTIN_ELEMENTS, CHILD_SETTER_TYPES, CONTENT_SETTER_TYPES } from "./element-config.js";

type AdwChildSetter =
    | Adw.Bin |
    Adw.BreakpointBin |
    Adw.Clamp |
    Adw.Dialog |
    Adw.NavigationPage |
    Adw.SplitButton |
    Adw.StatusPage |
    Adw.TabOverview |
    Adw.ToastOverlay |
    Adw.Toggle;

type AdwContentSetter = Adw.ApplicationWindow | Adw.BottomSheet | Adw.OverlaySplitView | Adw.Window;
type BreakpointHost = Adw.ApplicationWindow | Adw.Window | Adw.Dialog;
type PrefixSuffixRow = Adw.ActionRow | Adw.EntryRow | Adw.ExpanderRow;

const SLOT_SUFFIX = "Slot";
const childSetter = childSetterSlot<AdwChildSetter>();
const contentSetter = contentSetterSlot<AdwContentSetter>();

const breakpoints = slot<BreakpointHost, Adw.Breakpoint>("breakpoints", "AdwBreakpoint", {
    attach: (host, breakpoint) => {
        host.addBreakpoint(breakpoint);
    },
});

const prefixSuffix = [
    addRemoveSlot<Gtk.Widget, PrefixSuffixRow>(
        "prefix",
        "GtkWidget",
        (row, child) => {
            row.addPrefix(child);
        },
        (row, child) => {
            row.remove(child);
        },
    ),
    addRemoveSlot<Gtk.Widget, PrefixSuffixRow>(
        "suffix",
        "GtkWidget",
        (row, child) => {
            row.addSuffix(child);
        },
        (row, child) => {
            row.remove(child);
        },
    ),
];

const preferencesDialogChildren = addRemoveSlot<Adw.PreferencesPage, Adw.PreferencesDialog>(
    "children",
    "AdwPreferencesPage",
    (dialog, page) => {
        dialog.add(page);
    },
    (dialog, page) => {
        dialog.remove(page);
    },
);

const alertDialogExtraChild = slot<Adw.AlertDialog, Gtk.Widget>("children", "GtkWidget", {
    attach: (dialog, child) => {
        dialog.setExtraChild(child);
    },
    detach: (dialog) => {
        dialog.setExtraChild(null);
    },
});

const sidebarSections = indexedSlot<Adw.Sidebar, Adw.SidebarSection>("children", "AdwSidebarSection");
const sidebarItems = indexedSlot<Adw.SidebarSection, Adw.SidebarItem>("children", "AdwSidebarItem");
const isWidget = childMatcher("GtkWidget");

const multiLayoutSlots: ElementBehavior<Adw.MultiLayoutView> = {
    attach: (view, child, info) => {
        const id = getSlotId(info.slot);

        if (id === null || !isWidget(child)) {
            return;
        }

        view.setChild(id, child as Gtk.Widget);

        return true;
    },
    detach: (view, child, info) => {
        const id = getSlotId(info.slot);

        if (id === null || !isWidget(child)) {
            return;
        }

        const widget = child as Gtk.Widget;

        if (view.getChild(id) === widget) {
            widget.unparent();
        }
    },
};

const multiLayoutLayouts = slot<Adw.MultiLayoutView, Gtk.Widget>("layouts", "GtkWidget", {
    attach: (view, content) => {
        const layout = new Adw.Layout({ content });
        view.addLayout(layout);

        return layout;
    },
    reorder: (_view, _content, info) => info.adopted,
    detach: (view, _content, info) => {
        if (info.adopted instanceof Adw.Layout) {
            view.removeLayout(info.adopted);
        }
    },
});

const BUILTIN_BEHAVIORS: Record<string, ElementConfig<never>> = {
    AdwApplication: {
        behaviors: [applicationCreator(Adw.Application)],
    },
    AdwSidebar: {
        behaviors: [sidebarSections],
    },
    AdwSidebarSection: {
        behaviors: [sidebarItems],
    },
    AdwMultiLayoutView: {
        behaviors: [
            multiLayoutLayouts,
            multiLayoutSlots,
            deferred<Adw.MultiLayoutView, string>("layoutName", (view, name) => view.getLayoutByName(name) !== null),
        ],
    },
    AdwClampScrollable: {
        behaviors: [
            slot<Adw.ClampScrollable, Gtk.Scrollable & Gtk.Widget>("children", "GtkScrollable", {
                attach: (clamp, child) => {
                    clamp.setChild(child);
                },
                detach: (clamp) => {
                    clamp.setChild(null);
                },
            }),
        ],
    },
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
        ],
    },
    AdwNavigationSplitView: {
        behaviors: [contentSetterSlot<Adw.NavigationSplitView, Adw.NavigationPage>("AdwNavigationPage")],
    },
    AdwWrapBox: {
        behaviors: [boxSlot<Adw.WrapBox>()],
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
        behaviors: [preferencesDialogChildren],
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
            addRemoveSlot<Gtk.Widget, Adw.ToolbarView>(
                "topBar",
                "GtkWidget",
                (view, child) => {
                    view.addTopBar(child);
                },
                (view, child) => {
                    view.remove(child);
                },
            ),
            addRemoveSlot<Gtk.Widget, Adw.ToolbarView>(
                "bottomBar",
                "GtkWidget",
                (view, child) => {
                    view.addBottomBar(child);
                },
                (view, child) => {
                    view.remove(child);
                },
            ),
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
            alertDialogExtraChild,
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

function getSlotId(name: string): string | null {
    if (name.length <= SLOT_SUFFIX.length || !name.endsWith(SLOT_SUFFIX)) {
        return null;
    }

    return name.slice(0, -SLOT_SUFFIX.length);
}

registerElements(BUILTIN_ELEMENTS);
registerElements(BUILTIN_BEHAVIORS);
