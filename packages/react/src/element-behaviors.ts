import type * as GObject from "@gtkx/gi/gobject";
import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import type {
    ActionAccel,
    AlertDialogResponse,
    AboutDialogLink,
    AboutDialogSection,
    AboutDialogLegalSection,
    AboutDialogOtherApp,
    CreditSection,
    DragSourceIcon,
    LevelBarOffset,
    MainOption,
    ScaleMark,
    TabExtraDropTarget,
} from "./prop-types.js";
import { BUILTIN_ELEMENTS, CONTENT_SETTER_TYPES, SINGLE_CHILD_TYPES } from "@gtkx/config/elements";
import {
    applicationCreator,
    boxSlot,
    childMatcher,
    childSetterSlot,
    contentSetterSlot,
    controlledText,
    indexedSlot,
    keyedList,
    list,
    methodSlot,
    rowSlot,
    setterSlot,
    slot,
    value,
} from "./reconciler/behaviors.js";
import {
    type ElementBehavior,
    type ElementConfig,
    type PlaceInfo,
    type Props,
    forTypes,
    registerElements,
} from "./reconciler/registry.js";
import { applyWrite } from "./reconciler/signals.js";

type AdwChildSetter =
    | Adw.Bin
    | Adw.BreakpointBin
    | Adw.Clamp
    | Adw.Dialog
    | Adw.NavigationPage
    | Adw.SplitButton
    | Adw.StatusPage
    | Adw.TabOverview
    | Adw.ToastOverlay
    | Adw.Toggle;

type AdwContentSetter = Adw.ApplicationWindow | Adw.BottomSheet | Adw.OverlaySplitView | Adw.Window;
type BreakpointHost = Adw.ApplicationWindow | Adw.Window | Adw.Dialog;
type PrefixSuffixRow = Adw.ActionRow | Adw.EntryRow | Adw.ExpanderRow;

const ROW_LAYOUTS = [
    childMatcher(Adw.ActionRow),
    childMatcher(Adw.EntryRow),
    childMatcher(Adw.ExpanderRow),
    childMatcher(Adw.ButtonRow),
];
const isPlainRow = (row: Gtk.ListBoxRow): boolean => !ROW_LAYOUTS.some((isLayoutRow) => isLayoutRow(row));

const SLOT_SUFFIX = "Slot";
const childSetter = childSetterSlot<AdwChildSetter>();
const contentSetter = contentSetterSlot<AdwContentSetter>(Gtk.Widget);
const breakpoints = methodSlot<BreakpointHost, Adw.Breakpoint>("breakpoints", Adw.Breakpoint, "addBreakpoint");

const prefixSuffix = [
    methodSlot<PrefixSuffixRow, Gtk.Widget>("prefix", Gtk.Widget, "addPrefix", "remove"),
    methodSlot<PrefixSuffixRow, Gtk.Widget>("suffix", Gtk.Widget, "addSuffix", "remove"),
];

const preferencesDialogChildren = methodSlot<Adw.PreferencesDialog, Adw.PreferencesPage>(
    "children",
    Adw.PreferencesPage,
    "add",
    "remove",
);

const alertDialogExtraChild = setterSlot<Adw.AlertDialog, Gtk.Widget>("children", Gtk.Widget, "setExtraChild");
const applyResponseState = (dialog: Adw.AlertDialog, response: AlertDialogResponse): void => {
    dialog.setResponseAppearance(response.id, response.appearance ?? Adw.ResponseAppearance.DEFAULT);
    dialog.setResponseEnabled(response.id, response.isEnabled ?? true);
};
const sidebarSections = indexedSlot<Adw.Sidebar, Adw.SidebarSection>("children", Adw.SidebarSection);
const sidebarItems = indexedSlot<Adw.SidebarSection, Adw.SidebarItem>("children", Adw.SidebarItem);
const isWidget = childMatcher(Gtk.Widget);
const TEXT_CHILD_ANCHOR_PROP = "textChildAnchor";
const ACTION_GROUP_PREFIX_PROP = "prefix";
const tabExtraDropTarget = value<Adw.TabBar | Adw.TabOverview, TabExtraDropTarget | null>(
    "extraDropTarget",
    (tabs, target) => tabs.setupExtraDropTarget(target?.actions ?? 0, target?.types ?? null),
    null,
);

/**
 * GTK 4.22 updates the label widget's mnemonic mode without refreshing the check button's
 * accessible label. Reassigning the existing label refreshes that native accessibility property.
 * https://github.com/GNOME/gtk/blob/4.22.4/gtk/gtkcheckbutton.c#L1161
 */
const checkButtonUnderline = value<Gtk.CheckButton, boolean>(
    "useUnderline",
    (button, useUnderline) => {
        button.setUseUnderline(useUnderline);
        const label = button.getLabel();
        if (label !== null) {
            applyWrite("label", () => button.setLabel(label));
        }
    },
    false,
);

const tabViewParent = (child: Gtk.Widget): Adw.TabView | null => {
    for (let parent = child.getParent(); parent !== null; parent = parent.getParent()) {
        if (parent instanceof Adw.TabView) {
            return parent;
        }
    }

    return null;
};

const tabInsertionPosition = (view: Adw.TabView, info: PlaceInfo): number => {
    const successor = info.children
        .slice(info.index + 1)
        .find(
            (child) => child instanceof Gtk.Widget && tabViewParent(child) === view && !view.getPage(child).getPinned(),
        );

    return successor instanceof Gtk.Widget ? view.getPagePosition(view.getPage(successor)) : view.getNPages();
};

const selectedReplacedPages: WeakSet<Props> = new WeakSet();

const attachTabPage = (view: Adw.TabView, child: Gtk.Widget, info: PlaceInfo): Adw.TabPage => {
    const page =
        info.props.parent instanceof Adw.TabPage
            ? view.addPage(child, info.props.parent)
            : view.insert(child, tabInsertionPosition(view, info));

    if (selectedReplacedPages.delete(info.props)) {
        view.setSelectedPage(page);
    }

    return page;
};

const closeTabPage = (view: Adw.TabView, page: Adw.TabPage, props: Props): void => {
    if (view.getSelectedPage() === page) {
        selectedReplacedPages.add(props);
    }

    view.setPagePinned(page, false);
    view.closePage(page);
};

const reorderTabPages = (view: Adw.TabView, children: readonly GObject.Object[]): void => {
    const pages = children
        .filter((child): child is Gtk.Widget => child instanceof Gtk.Widget && tabViewParent(child) === view)
        .map((child) => view.getPage(child));
    const ordered = [...pages.filter((page) => page.getPinned()), ...pages.filter((page) => !page.getPinned())];
    const known = new Set(pages);
    const positions = Array.from({ length: view.getNPages() }, (_, index) => index).filter((index) =>
        known.has(view.getNthPage(index)),
    );

    for (const [index, position] of positions.entries()) {
        const page = ordered[index];
        if (page !== undefined && view.getPagePosition(page) !== position) {
            view.reorderPage(page, position);
        }
    }
};

const textViewAnchorChildren: ElementBehavior<Gtk.TextView> = {
    attach: (view, child, info) => {
        const anchor = info.props[TEXT_CHILD_ANCHOR_PROP];

        if (!isWidget(child) || !(anchor instanceof Gtk.TextChildAnchor)) {
            return;
        }

        view.addChildAtAnchor(child, anchor);

        return true;
    },
    detach: (view, child) => {
        if (isWidget(child) && child.getParent() === view) {
            view.remove(child);
        }
    },
};

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

const overlaySlot = (name: string) =>
    slot<Gtk.Overlay, Gtk.Widget>(name, Gtk.Widget, {
        attach: (overlay, child) => {
            overlay.addOverlay(child);
        },
        detach: (overlay, child) => {
            overlay.removeOverlay(child);
        },
        resolve: layoutChild,
    });

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
    ...forTypes(
        SINGLE_CHILD_TYPES.filter((type) => type !== "GtkListBoxRow"),
        {
            behaviors: [childSetterSlot()],
        },
    ),
    GtkListBoxRow: {
        behaviors: [childSetterSlot<Gtk.ListBoxRow>(isPlainRow)],
    },
    ...forTypes(["GtkHeaderBar", "GtkActionBar"], {
        behaviors: [
            methodSlot<Gtk.HeaderBar | Gtk.ActionBar, Gtk.Widget>("start", Gtk.Widget, "packStart", "remove"),
            methodSlot<Gtk.HeaderBar | Gtk.ActionBar, Gtk.Widget>("end", Gtk.Widget, "packEnd", "remove"),
        ],
    }),
    GtkWindow: {
        behaviors: [childSetterSlot()],
    },
    GtkMenuButton: {
        behaviors: [
            setterSlot<Gtk.MenuButton, Gtk.Popover>("children", Gtk.Popover, "setPopover"),
            childSetterSlot<Gtk.MenuButton>(),
        ],
    },
    GtkCheckButton: {
        behaviors: [checkButtonUnderline, childSetterSlot<Gtk.CheckButton>()],
    },
    GtkWidget: {
        behaviors: [
            value<Gtk.Widget, Gtk.TextDirection | null>(
                "textDirection",
                (widget, direction) => widget.setDirection(direction ?? Gtk.TextDirection.NONE),
                Gtk.TextDirection.NONE,
            ),
            {
                update: () => [TEXT_CHILD_ANCHOR_PROP],
            },
            slot<Gtk.Widget, Gtk.Popover>("children", Gtk.Popover, {
                attach: (parent, popover) => {
                    popover.setParent(parent);
                },
                detach: (_parent, popover) => {
                    popover.unparent();
                },
            }),
            methodSlot<Gtk.Widget, Gtk.EventController>(
                "controllers",
                Gtk.EventController,
                "addController",
                "removeController",
            ),
            setterSlot<Gtk.Widget, Gtk.LayoutManager>("layoutManager", Gtk.LayoutManager, "setLayoutManager"),
            slot<Gtk.Widget, Gio.ActionGroup>("actionGroups", Gio.ActionGroup, {
                attach: (widget, group, info) => {
                    widget.insertActionGroup((info.props[ACTION_GROUP_PREFIX_PROP] as string | null) ?? "", group);
                },
                detach: (widget, _group, info) => {
                    widget.insertActionGroup((info.props[ACTION_GROUP_PREFIX_PROP] as string | null) ?? "", null);
                },
            }),
        ],
    },
    GActionGroup: {
        behaviors: [
            {
                update: () => [ACTION_GROUP_PREFIX_PROP],
            },
        ],
    },
    GtkBox: {
        behaviors: [boxSlot<Gtk.Box>()],
    },
    GtkListBox: {
        behaviors: [
            rowSlot<Gtk.ListBox>(),
            setterSlot<Gtk.ListBox, Gtk.Widget>("placeholder", Gtk.Widget, "setPlaceholder"),
        ],
    },
    GtkFlowBox: {
        behaviors: [rowSlot<Gtk.FlowBox>()],
    },
    GtkOverlay: {
        behaviors: [childSetterSlot<Gtk.Overlay>(), overlaySlot("overlay"), overlaySlot("overlays")],
    },
    GtkShortcutController: {
        behaviors: [
            methodSlot<Gtk.ShortcutController, Gtk.Shortcut>(
                "shortcuts",
                Gtk.Shortcut,
                "addShortcut",
                "removeShortcut",
            ),
        ],
    },
    GtkCallbackAction: {
        behaviors: [
            {
                create: (props) => Gtk.CallbackAction.new(props.callback as Gtk.ShortcutFunc),
            },
        ],
    },
    GtkCustomLayout: {
        behaviors: [
            {
                create: (props) =>
                    Gtk.CustomLayout.new(
                        (props.requestMode as Gtk.CustomRequestModeFunc | null) ?? null,
                        props.measure as Gtk.CustomMeasureFunc,
                        props.allocate as Gtk.CustomAllocateFunc,
                    ),
            },
        ],
    },
    GtkShortcutTrigger: {
        behaviors: [
            {
                create: (props) => {
                    const trigger = Gtk.ShortcutTrigger.parseString(props.accelerator as string);

                    if (trigger === null) {
                        throw new Error("Invalid shortcut accelerator");
                    }

                    return trigger;
                },
            },
        ],
    },
    GtkTextChildAnchor: {
        behaviors: [
            {
                create: (props) =>
                    props.replacement === undefined
                        ? Gtk.TextChildAnchor.new()
                        : Gtk.TextChildAnchor.newWithReplacement(props.replacement as string),
            },
        ],
    },
    GtkTextView: {
        behaviors: [
            setterSlot<Gtk.TextView, Gtk.TextBuffer>("children", Gtk.TextBuffer, "setBuffer"),
            textViewAnchorChildren,
        ],
    },
    GActionMap: {
        behaviors: [
            slot<Gio.ActionMap, Gio.Action>("actions", Gio.Action, {
                attach: (map, action) => {
                    map.addAction(action);
                },
                detach: (map, _action, info) => {
                    map.removeAction((info.props.name as string | null) ?? "");
                },
            }),
        ],
    },
    GMenu: {
        behaviors: [
            slot<Gio.Menu, Gio.MenuItem>("children", Gio.MenuItem, {
                attach: (menu, item, info) => {
                    menu.insertItem(info.index, item);
                },
                detach: (menu, _item, info) => {
                    menu.remove(info.index);
                },
            }),
        ],
    },
    GMenuItem: {
        behaviors: [
            value<Gio.MenuItem, string | null>("label", (item, label) => {
                item.setLabel(label);
            }),
            value<Gio.MenuItem, string | null>("action", (item, action) => {
                if (action === null) {
                    item.setActionAndTargetValue(null, null);
                } else {
                    item.setDetailedAction(action);
                }
            }),
            setterSlot<Gio.MenuItem, Gio.MenuModel>("submenu", Gio.MenuModel, "setSubmenu"),
            setterSlot<Gio.MenuItem, Gio.MenuModel>("section", Gio.MenuModel, "setSection"),
        ],
    },
    GtkColumnView: {
        behaviors: [
            slot<Gtk.ColumnView, Gtk.ColumnViewColumn>("children", Gtk.ColumnViewColumn, {
                attach: (view, column, info) => {
                    view.insertColumn(info.index, column);
                },
                detach: (view, column) => {
                    view.removeColumn(column);
                },
            }),
        ],
    },
    GtkGrid: {
        behaviors: [
            slot<Gtk.Grid, Gtk.Widget>("children", Gtk.Widget, {
                attach: (grid, child) => {
                    grid.attach(child, 0, 0, 1, 1);
                },
                detach: (grid, child) => {
                    grid.remove(child);
                },
                resolve: layoutChild,
            }),
        ],
    },
    GtkFixed: {
        behaviors: [
            slot<Gtk.Fixed, Gtk.Widget>("children", Gtk.Widget, {
                attach: (fixed, child) => {
                    fixed.put(child, 0, 0);
                },
                detach: (fixed, child) => {
                    fixed.remove(child);
                },
                resolve: layoutChild,
            }),
        ],
    },
    GtkSizeGroup: {
        behaviors: [
            list<Gtk.SizeGroup, Gtk.Widget>("widgets", {
                add: (group, widget) => {
                    group.addWidget(widget);
                },
                remove: (group, widget) => {
                    group.removeWidget(widget);
                },
            }),
        ],
    },
    GtkConstraintLayout: {
        behaviors: [
            methodSlot<Gtk.ConstraintLayout, Gtk.Constraint>(
                "constraints",
                Gtk.Constraint,
                "addConstraint",
                "removeConstraint",
            ),
            methodSlot<Gtk.ConstraintLayout, Gtk.ConstraintGuide>(
                "guides",
                Gtk.ConstraintGuide,
                "addGuide",
                "removeGuide",
            ),
        ],
    },
    GtkStack: {
        behaviors: [methodSlot<Gtk.Stack, Gtk.Widget>("children", Gtk.Widget, "addChild", "remove")],
    },
    GtkNotebook: {
        behaviors: [
            slot<Gtk.Notebook, Gtk.Widget>("children", Gtk.Widget, {
                attach: (notebook, child, info) => notebook.insertPage(child, null, info.index),
                reorder: (notebook, child, info) => {
                    notebook.reorderChild(child, info.index);
                },
                detach: (notebook, child) => {
                    notebook.detachTab(child);
                },
                resolve: (notebook, child) => notebook.getPage(child),
            }),
        ],
    },
    GtkApplication: {
        behaviors: [
            applicationCreator(Gtk.Application),
            methodSlot<Gtk.Application, Gtk.Window>("children", Gtk.Window, "addWindow", "removeWindow"),
            list<Gtk.Application, ActionAccel>("actionAccels", {
                add: (application, item) => {
                    application.setAccelsForAction(item.detailedActionName, item.accels);
                },
                remove: (application, item) => {
                    application.setAccelsForAction(item.detailedActionName, []);
                },
            }),
            list<Gtk.Application, MainOption>("mainOptions", {
                add: (application, option) => {
                    addMainOption(application, option);
                },
            }),
        ],
    },
    GtkAboutDialog: {
        behaviors: [
            list<Gtk.AboutDialog, CreditSection>("creditSections", {
                add: (dialog, section) => {
                    dialog.addCreditSection(section.sectionName, section.people);
                },
            }),
        ],
    },
    AdwAboutDialog: {
        behaviors: [
            list<Adw.AboutDialog, AboutDialogLink>("links", {
                add: (dialog, link) => dialog.addLink(link.title, link.url),
            }),
            list<Adw.AboutDialog, AboutDialogSection>("creditSections", {
                add: (dialog, section) => dialog.addCreditSection(section.name ?? null, section.people),
            }),
            list<Adw.AboutDialog, AboutDialogSection>("acknowledgementSections", {
                add: (dialog, section) => dialog.addAcknowledgementSection(section.name ?? null, section.people),
            }),
            list<Adw.AboutDialog, AboutDialogLegalSection>("legalSections", {
                add: (dialog, section) =>
                    dialog.addLegalSection(
                        section.title,
                        section.copyright ?? null,
                        section.licenseType,
                        section.license ?? null,
                    ),
            }),
            list<Adw.AboutDialog, AboutDialogOtherApp>("otherApps", {
                add: (dialog, app) => dialog.addOtherApp(app.appid, app.name, app.summary),
            }),
        ],
    },
    AdwTabBar: {
        behaviors: [tabExtraDropTarget],
    },
    AdwTabOverview: {
        behaviors: [childSetterSlot<Adw.TabOverview>(), tabExtraDropTarget],
    },
    AdwTabPage: {
        behaviors: [
            value<Adw.TabPage, boolean>(
                "pinned",
                (page, pinned) => tabViewParent(page.getChild())?.setPagePinned(page, pinned),
                false,
            ),
        ],
    },
    GtkScale: {
        behaviors: [
            list<Gtk.Scale, ScaleMark>("marks", {
                add: (scale, mark) => {
                    scale.addMark(mark.value ?? 0, mark.position, mark.markup ?? null);
                },
                clear: (scale) => {
                    scale.clearMarks();
                },
            }),
        ],
    },
    GtkCalendar: {
        behaviors: [
            list<Gtk.Calendar, number>("markedDays", {
                add: (calendar, day) => {
                    calendar.markDay(day);
                },
                clear: (calendar) => {
                    calendar.clearMarks();
                },
            }),
        ],
    },
    GtkLevelBar: {
        behaviors: [
            list<Gtk.LevelBar, LevelBarOffset>("offsets", {
                add: (bar, offset) => {
                    bar.addOffsetValue(offset.name, offset.value ?? 0);
                },
                remove: (bar, offset) => {
                    bar.removeOffsetValue(offset.name);
                },
            }),
        ],
    },
    GtkDropTarget: {
        behaviors: [
            value<Gtk.DropTarget, GObject.Type[]>("types", (target, types) => {
                target.setGtypes(types);
            }),
        ],
    },
    GtkDrawingArea: {
        behaviors: [
            value<Gtk.DrawingArea, Gtk.DrawingAreaDrawFunc | null>(
                "drawFunc",
                (area, draw) => {
                    area.setDrawFunc(draw);
                    area.queueDraw();
                },
                null,
            ),
        ],
    },
    GtkDragSource: {
        behaviors: [
            value<Gtk.DragSource, DragSourceIcon | null>("icon", (source, icon) => {
                source.setIcon(icon?.paintable ?? null, icon?.hotX ?? 0, icon?.hotY ?? 0);
            }),
        ],
    },
    GtkEditable: {
        behaviors: [controlledText("text")],
    },
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
        behaviors: [multiLayoutLayouts, multiLayoutSlots],
    },
    AdwClampScrollable: {
        behaviors: [
            setterSlot<Adw.ClampScrollable, Gtk.Scrollable & Gtk.Widget>("children", scrollableWidget, "setChild"),
        ],
    },
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
                "breakpoints",
                Adw.Breakpoint,
                "addBreakpoint",
                "removeBreakpoint",
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
        behaviors: [...prefixSuffix, methodSlot<Adw.ExpanderRow, Gtk.Widget>("rows", Gtk.Widget, "addRow", "remove")],
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
                attach: attachTabPage,
                reorder: (view, _child, info) => {
                    reorderTabPages(view, info.children);

                    return info.adopted;
                },
                detach: (_view, child, info) => {
                    const owner = tabViewParent(child);

                    if (info.adopted instanceof Adw.TabPage && owner !== null) {
                        closeTabPage(owner, info.adopted, info.props);
                    }
                },
                resolve: (_view, child) => tabViewParent(child)?.getPage(child) ?? null,
            }),
        ],
    },
    AdwNavigationView: {
        behaviors: [
            methodSlot<Adw.NavigationView, Adw.NavigationPage>("children", Adw.NavigationPage, "add", "remove"),
        ],
    },
    AdwViewStack: {
        behaviors: [methodSlot<Adw.ViewStack, Gtk.Widget>("children", Gtk.Widget, "add", "remove")],
    },
    AdwToolbarView: {
        behaviors: [
            contentSetterSlot<Adw.ToolbarView>(Gtk.Widget),
            methodSlot<Adw.ToolbarView, Gtk.Widget>("top", Gtk.Widget, "addTopBar", "remove"),
            methodSlot<Adw.ToolbarView, Gtk.Widget>("bottom", Gtk.Widget, "addBottomBar", "remove"),
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
        behaviors: [methodSlot<Adw.ToggleGroup, Adw.Toggle>("children", Adw.Toggle, "add", "remove")],
    },
    AdwAlertDialog: {
        behaviors: [
            alertDialogExtraChild,
            keyedList<Adw.AlertDialog, AlertDialogResponse>("responses", {
                key: (response) => response.id,
                add: (dialog, response) => {
                    dialog.addResponse(response.id, response.label);
                    applyResponseState(dialog, response);
                },
                update: (dialog, response) => {
                    dialog.setResponseLabel(response.id, response.label);
                    applyResponseState(dialog, response);
                },
                remove: (dialog, response) => {
                    dialog.removeResponse(response.id);
                },
            }),
        ],
    },
};

function layoutChild(parent: Gtk.Widget, child: Gtk.Widget): GObject.Object | null {
    return parent.getLayoutManager()?.getLayoutChild(child) ?? null;
}

const addMainOption = (application: Gtk.Application, option: MainOption): void => {
    application.addMainOption(
        option.longName,
        option.shortName?.codePointAt(0) ?? 0,
        option.flags ?? GLib.OptionFlags.NONE,
        option.arg ?? GLib.OptionArg.NONE,
        option.description,
        option.argDescription ?? null,
    );
};

function getSlotId(name: string): string | null {
    if (name.length <= SLOT_SUFFIX.length || !name.endsWith(SLOT_SUFFIX)) {
        return null;
    }

    return name.slice(0, -SLOT_SUFFIX.length);
}

registerElements(BUILTIN_ELEMENTS);
registerElements(BUILTIN_BEHAVIORS);
