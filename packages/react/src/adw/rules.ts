import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import {
    addRemoveBehavior,
    boxBehavior,
    type ContainerBehavior,
    childSetterBehavior,
    contentSetterBehavior,
    defineContainer,
    defineLazy,
    defineList,
    indexedBehavior,
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

type AdwContentSetter =
    | Adw.ApplicationWindow
    | Adw.BottomSheet
    | Adw.Flap
    | Adw.OverlaySplitView
    | Adw.Window
    | Adw.ToolbarView;

defineContainer<AdwChildSetter, Gtk.Widget>(
    [
        "AdwBin",
        "AdwBreakpointBin",
        "AdwClamp",
        "AdwClampScrollable",
        "AdwDialog",
        "AdwNavigationPage",
        "AdwSplitButton",
        "AdwStatusPage",
        "AdwTabOverview",
        "AdwToastOverlay",
        "AdwToggle",
    ],
    "children",
    "GtkWidget",
    { behavior: childSetterBehavior<AdwChildSetter>() },
);

defineContainer<AdwContentSetter, Gtk.Widget>(
    ["AdwApplicationWindow", "AdwBottomSheet", "AdwFlap", "AdwOverlaySplitView", "AdwWindow", "AdwToolbarView"],
    "children",
    "GtkWidget",
    { behavior: contentSetterBehavior<AdwContentSetter>() },
);

defineContainer<Adw.NavigationSplitView, Adw.NavigationPage>(
    ["AdwNavigationSplitView"],
    "children",
    "AdwNavigationPage",
    { behavior: contentSetterBehavior<Adw.NavigationSplitView, Adw.NavigationPage>() },
);

defineContainer<Adw.Leaflet | Adw.WrapBox, Gtk.Widget>(["AdwLeaflet", "AdwWrapBox"], "children", "GtkWidget", {
    behavior: boxBehavior<Adw.Leaflet | Adw.WrapBox>(),
});

defineContainer<Adw.Carousel, Gtk.Widget>(["AdwCarousel"], "children", "GtkWidget", {
    behavior: {
        ...indexedBehavior<Gtk.Widget, Adw.Carousel>(),
        reorder: (carousel, child, { index }) => carousel.reorder(child, index),
    },
});

defineContainer<Adw.PreferencesPage, Adw.PreferencesGroup>(["AdwPreferencesPage"], "children", "AdwPreferencesGroup", {
    behavior: {
        attach: (page, group) => page.add(group),
        detach: (page, group) => page.remove(group),
        insert: (page, group, { index }) => page.insert(group, index),
    },
});

defineContainer<Adw.TabView, Gtk.Widget>(["AdwTabView"], "children", "GtkWidget", {
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
});

defineContainer<Adw.NavigationView, Adw.NavigationPage>(["AdwNavigationView"], "children", "AdwNavigationPage", {
    behavior: addRemoveBehavior(
        (view, page) => {
            view.add(page);
        },
        (view, page) => {
            view.remove(page);
        },
    ),
});

type PageHost = Adw.PreferencesDialog | Adw.PreferencesWindow;

defineContainer<PageHost, Adw.PreferencesPage>(
    ["AdwPreferencesDialog", "AdwPreferencesWindow"],
    "children",
    "AdwPreferencesPage",
    {
        behavior: addRemoveBehavior(
            (host, page) => {
                host.add(page);
            },
            (host, page) => {
                host.remove(page);
            },
        ),
    },
);

defineContainer<Adw.PreferencesGroup, Gtk.Widget>(["AdwPreferencesGroup"], "children", "GtkWidget", {
    behavior: addRemoveBehavior(
        (group, child) => {
            group.add(child);
        },
        (group, child) => {
            group.remove(child);
        },
    ),
});

defineContainer<Adw.Squeezer, Gtk.Widget>(["AdwSqueezer"], "children", "GtkWidget", {
    behavior: addRemoveBehavior(
        (squeezer, child) => {
            squeezer.add(child);
        },
        (squeezer, child) => {
            squeezer.remove(child);
        },
    ),
});

defineContainer<Adw.ViewStack, Gtk.Widget>(["AdwViewStack"], "children", "GtkWidget", {
    adopt: "result",
    behavior: {
        attach: (stack, child) => stack.add(child),
        detach: (stack, child) => stack.remove(child),
    },
});

defineLazy<Adw.ViewStack, string>(["AdwViewStack"], "visibleChildName", (stack, name) => {
    return stack.getChildByName(name) !== null;
});

type BreakpointHost = Adw.ApplicationWindow | Adw.Window | Adw.Dialog;

defineContainer<BreakpointHost, Adw.Breakpoint>(
    ["AdwApplicationWindow", "AdwWindow", "AdwDialog"],
    "breakpoints",
    "AdwBreakpoint",
    {
        behavior: {
            attach: (host, breakpoint) => host.addBreakpoint(breakpoint),
        },
    },
);

defineContainer<Adw.BreakpointBin, Adw.Breakpoint>(["AdwBreakpointBin"], "breakpoints", "AdwBreakpoint", {
    behavior: addRemoveBehavior(
        (bin, breakpoint) => {
            bin.addBreakpoint(breakpoint);
        },
        (bin, breakpoint) => {
            bin.removeBreakpoint(breakpoint);
        },
    ),
});

type PrefixSuffixRow = Adw.ActionRow | Adw.EntryRow | Adw.ExpanderRow;

const PREFIX_SUFFIX_ROWS = ["AdwActionRow", "AdwEntryRow", "AdwExpanderRow"];

const rowSlotBehavior = (
    add: (row: PrefixSuffixRow, child: Gtk.Widget) => void,
): ContainerBehavior<PrefixSuffixRow, Gtk.Widget> =>
    addRemoveBehavior(add, (row, child) => {
        row.remove(child);
    });

defineContainer<PrefixSuffixRow, Gtk.Widget>(PREFIX_SUFFIX_ROWS, "prefix", "GtkWidget", {
    behavior: rowSlotBehavior((row, child) => {
        row.addPrefix(child);
    }),
});

defineContainer<PrefixSuffixRow, Gtk.Widget>(PREFIX_SUFFIX_ROWS, "suffix", "GtkWidget", {
    behavior: rowSlotBehavior((row, child) => {
        row.addSuffix(child);
    }),
});

defineContainer<Adw.ExpanderRow, Gtk.Widget>(["AdwExpanderRow"], "rows", "GtkWidget", {
    behavior: addRemoveBehavior(
        (row, child) => {
            row.addRow(child);
        },
        (row, child) => {
            row.remove(child);
        },
    ),
});

defineContainer<Adw.ExpanderRow, Gtk.Widget>(["AdwExpanderRow"], "actions", "GtkWidget", {
    behavior: addRemoveBehavior(
        (row, child) => {
            row.addAction(child);
        },
        (row, child) => {
            row.remove(child);
        },
    ),
});

const headerBarSlot = (
    pack: (bar: Adw.HeaderBar, child: Gtk.Widget) => void,
): ContainerBehavior<Adw.HeaderBar, Gtk.Widget> =>
    addRemoveBehavior(pack, (bar, child) => {
        bar.remove(child);
    });

defineContainer<Adw.HeaderBar, Gtk.Widget>(["AdwHeaderBar"], "start", "GtkWidget", {
    behavior: headerBarSlot((bar, child) => {
        bar.packStart(child);
    }),
});

defineContainer<Adw.HeaderBar, Gtk.Widget>(["AdwHeaderBar"], "end", "GtkWidget", {
    behavior: headerBarSlot((bar, child) => {
        bar.packEnd(child);
    }),
});

const toolbarSlot = (
    add: (view: Adw.ToolbarView, child: Gtk.Widget) => void,
): ContainerBehavior<Adw.ToolbarView, Gtk.Widget> =>
    addRemoveBehavior(add, (view, child) => {
        view.remove(child);
    });

defineContainer<Adw.ToolbarView, Gtk.Widget>(["AdwToolbarView"], "topBar", "GtkWidget", {
    behavior: toolbarSlot((view, child) => {
        view.addTopBar(child);
    }),
});

defineContainer<Adw.ToolbarView, Gtk.Widget>(["AdwToolbarView"], "bottomBar", "GtkWidget", {
    behavior: toolbarSlot((view, child) => {
        view.addBottomBar(child);
    }),
});

defineContainer<Adw.ShortcutsDialog, Adw.ShortcutsSection>(["AdwShortcutsDialog"], "children", "AdwShortcutsSection", {
    behavior: { attach: (dialog, section) => dialog.add(section) },
});

defineContainer<Adw.ShortcutsSection, Adw.ShortcutsItem>(["AdwShortcutsSection"], "children", "AdwShortcutsItem", {
    behavior: { attach: (section, item) => section.add(item) },
});

defineContainer<Adw.ToggleGroup, Adw.Toggle>(["AdwToggleGroup"], "children", "AdwToggle", {
    behavior: addRemoveBehavior(
        (group, toggle) => {
            group.add(toggle);
        },
        (group, toggle) => {
            group.remove(toggle);
        },
    ),
});

defineLazy<Adw.ToggleGroup, string>(["AdwToggleGroup"], "activeName", (group, name) => {
    return group.getToggleByName(name) !== null;
});

defineLazy(["AdwToggleGroup"], "active");

defineList<Adw.AlertDialog, AlertDialogResponse>(["AdwAlertDialog"], "responses", {
    add: (dialog, response) => {
        dialog.addResponse(response.id, response.label);
        if (response.appearance !== undefined) dialog.setResponseAppearance(response.id, response.appearance);
        if (response.enabled !== undefined) dialog.setResponseEnabled(response.id, response.enabled);
    },
    remove: (dialog, response) => dialog.removeResponse(response.id),
});
