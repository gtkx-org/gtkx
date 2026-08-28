import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import type { AlertDialogResponse } from "./prop-types.js";
import {
    applicationCreator,
    boxSlot,
    childMatcher,
    childSetterSlot,
    contentSetterSlot,
    deferred,
    indexedSlot,
    list,
    methodSlot,
    setterSlot,
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
const contentSetter = contentSetterSlot<AdwContentSetter>(Gtk.Widget);
const breakpoints = methodSlot<BreakpointHost, Adw.Breakpoint>("breakpoints", Adw.Breakpoint, "addBreakpoint");

const prefixSuffix = [
    methodSlot<PrefixSuffixRow, Gtk.Widget>("prefix", Gtk.Widget, "addPrefix", "remove"),
    methodSlot<PrefixSuffixRow, Gtk.Widget>("suffix", Gtk.Widget, "addSuffix", "remove"),
];

const preferencesDialogChildren = methodSlot<Adw.PreferencesDialog, Adw.PreferencesPage>(
    "children", Adw.PreferencesPage, "add", "remove",
);

const alertDialogExtraChild = setterSlot<Adw.AlertDialog, Gtk.Widget>("children", Gtk.Widget, "setExtraChild");
const sidebarSections = indexedSlot<Adw.Sidebar, Adw.SidebarSection>("children", Adw.SidebarSection);
const sidebarItems = indexedSlot<Adw.SidebarSection, Adw.SidebarItem>("children", Adw.SidebarItem);
const isWidget = childMatcher(Gtk.Widget);

const scrollableWidget = {
    [Symbol.hasInstance]: (value: unknown): value is Gtk.Scrollable & Gtk.Widget =>
        value instanceof Gtk.Scrollable && value instanceof Gtk.Widget,
};

const multiLayoutSlots: ElementBehavior<Adw.MultiLayoutView> = {
    attach: (view, child, info) => {
        const id = getSlotId(info.slot);

        if (id === null || !isWidget(child)) {
            return;
        }

        view.setChild(id, child);

        return true;
    },
    detach: (view, child, info) => {
        const id = getSlotId(info.slot);

        if (id === null || !isWidget(child)) {
            return;
        }

        if (view.getChild(id) === child) {
            child.unparent();
        }
    },
};

const multiLayoutLayouts = slot<Adw.MultiLayoutView, Gtk.Widget>("layouts", Gtk.Widget, {
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
            setterSlot<Adw.ClampScrollable, Gtk.Scrollable & Gtk.Widget>("children", scrollableWidget, "setChild"),
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
            methodSlot<Adw.BreakpointBin, Adw.Breakpoint>(
                "breakpoints", Adw.Breakpoint, "addBreakpoint", "removeBreakpoint",
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
            methodSlot<Adw.ExpanderRow, Gtk.Widget>("rows", Gtk.Widget, "addRow", "remove"),
        ],
    },
    AdwNavigationSplitView: {
        behaviors: [contentSetterSlot<Adw.NavigationSplitView, Adw.NavigationPage>(Adw.NavigationPage)],
    },
    AdwWrapBox: {
        behaviors: [boxSlot<Adw.WrapBox>()],
    },
    AdwCarousel: {
        behaviors: [
            slot<Adw.Carousel, Gtk.Widget>("children", Gtk.Widget, {
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
            slot<Adw.PreferencesPage, Adw.PreferencesGroup>("children", Adw.PreferencesGroup, {
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
        behaviors: [methodSlot<Adw.PreferencesGroup, Gtk.Widget>("children", Gtk.Widget, "add", "remove")],
    },
    AdwTabView: {
        behaviors: [
            slot<Adw.TabView, Gtk.Widget>("children", Gtk.Widget, {
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
            methodSlot<Adw.NavigationView, Adw.NavigationPage>("children", Adw.NavigationPage, "add", "remove"),
        ],
    },
    AdwViewStack: {
        behaviors: [
            methodSlot<Adw.ViewStack, Gtk.Widget>("children", Gtk.Widget, "add", "remove"),
            deferred<Adw.ViewStack, string>("visibleChildName", (stack, name) => stack.getChildByName(name) !== null),
        ],
    },
    AdwToolbarView: {
        behaviors: [
            contentSetterSlot<Adw.ToolbarView>(Gtk.Widget),
            methodSlot<Adw.ToolbarView, Gtk.Widget>("topBar", Gtk.Widget, "addTopBar", "remove"),
            methodSlot<Adw.ToolbarView, Gtk.Widget>("bottomBar", Gtk.Widget, "addBottomBar", "remove"),
        ],
    },
    AdwHeaderBar: {
        behaviors: [
            methodSlot<Adw.HeaderBar, Gtk.Widget>("start", Gtk.Widget, "packStart", "remove"),
            methodSlot<Adw.HeaderBar, Gtk.Widget>("end", Gtk.Widget, "packEnd", "remove"),
        ],
    },
    AdwShortcutsDialog: {
        behaviors: [methodSlot<Adw.ShortcutsDialog, Adw.ShortcutsSection>("children", Adw.ShortcutsSection, "add")],
    },
    AdwShortcutsSection: {
        behaviors: [methodSlot<Adw.ShortcutsSection, Adw.ShortcutsItem>("children", Adw.ShortcutsItem, "add")],
    },
    AdwToggleGroup: {
        behaviors: [
            methodSlot<Adw.ToggleGroup, Adw.Toggle>("children", Adw.Toggle, "add", "remove"),
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
