import type * as GObject from "@gtkx/gi/gobject";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import type {
    ActionAccel,
    CreditSection,
    DragSourceIcon,
    LevelBarOffset,
    MenuItem,
    ScaleMark,
    VflConstraints,
} from "./prop-types.js";
import {
    addRemoveSlot,
    adoptedChildrenSlot,
    boxSlot,
    childSetterSlot,
    controlledText,
    deferred,
    forTypes,
    internal,
    list,
    slot,
    value,
    wrappingIndexedSlot,
} from "./reconciler/behaviors.js";
import { type ElementConfig, registerElements } from "./reconciler/registry.js";

const layoutChild = (parent: Gtk.Widget, child: Gtk.Widget): GObject.Object | null =>
    parent.getLayoutManager()?.getLayoutChild(child) ?? null;

const buildMenu = (items: MenuItem[]): Gio.Menu => {
    const menu = Gio.Menu.new();
    for (const item of items) appendMenuItem(menu, item);
    return menu;
};

function appendMenuItem(menu: Gio.Menu, item: MenuItem): void {
    const label = item.label ?? null;
    if (item.submenu !== undefined) {
        menu.appendSubmenu(label, buildMenu(item.submenu));
        return;
    }
    if (item.section !== undefined) {
        menu.appendSection(label, buildMenu(item.section));
        return;
    }
    menu.append(label, item.action ?? null);
}

const SINGLE_CHILD_TYPES = [
    "GtkAspectFrame",
    "GtkButton",
    "GtkCheckButton",
    "GtkComboBox",
    "GtkDragIcon",
    "GtkExpander",
    "GtkFlowBoxChild",
    "GtkFrame",
    "GtkGraphicsOffload",
    "GtkListBoxRow",
    "GtkListHeader",
    "GtkListItem",
    "GtkMenuButton",
    "GtkPopover",
    "GtkPopoverBin",
    "GtkRevealer",
    "GtkScrolledWindow",
    "GtkSearchBar",
    "GtkTreeExpander",
    "GtkViewport",
    "GtkWindowHandle",
];

export const BUILTIN_ELEMENTS: Record<string, ElementConfig> = {
    ...forTypes(SINGLE_CHILD_TYPES, { props: internal("ChildrenProps"), behaviors: [childSetterSlot()] }),
    ...forTypes(["GtkHeaderBar", "GtkActionBar"], {
        props: internal("GtkHeaderBarProps"),
        behaviors: [
            addRemoveSlot<Gtk.Widget, Gtk.HeaderBar | Gtk.ActionBar>(
                "start",
                "GtkWidget",
                (bar, child) => {
                    bar.packStart(child);
                },
                (bar, child) => {
                    bar.remove(child);
                },
            ),
            addRemoveSlot<Gtk.Widget, Gtk.HeaderBar | Gtk.ActionBar>(
                "end",
                "GtkWidget",
                (bar, child) => {
                    bar.packEnd(child);
                },
                (bar, child) => {
                    bar.remove(child);
                },
            ),
        ],
    }),
    GtkWindow: {
        props: internal("ChildrenProps"),
        component: internal("createWindowComponent"),
        behaviors: [childSetterSlot()],
    },
    GtkLabel: { props: internal("ChildrenProps") },
    GtkTextBuffer: { props: internal("ChildrenProps") },
    GtkTextTag: { props: internal("ChildrenProps") },
    GtkTextChildAnchor: { props: internal("ChildrenProps") },
    GtkGridLayoutChild: { lazy: true },
    GtkFixedLayoutChild: { lazy: true },
    GtkOverlayLayoutChild: { lazy: true },
    GtkStackPage: { lazy: true },
    GtkNotebookPage: { lazy: true },
    GActionGroup: { props: internal("GActionGroupProps") },
    GtkWidget: {
        props: internal("GtkWidgetProps"),
        behaviors: [
            slot<Gtk.Widget, Gtk.Popover>("children", "GtkPopover", {
                attach: (parent, popover) => popover.setParent(parent),
                detach: (_parent, popover) => popover.unparent(),
            }),
            addRemoveSlot<Gtk.EventController, Gtk.Widget>(
                "controllers",
                "GtkEventController",
                (widget, controller) => {
                    widget.addController(controller);
                },
                (widget, controller) => {
                    widget.removeController(controller);
                },
            ),
            slot<Gtk.Widget, Gtk.LayoutManager>("layoutManager", "GtkLayoutManager", {
                attach: (widget, manager) => widget.setLayoutManager(manager),
                detach: (widget) => widget.setLayoutManager(null),
            }),
            slot<Gtk.Widget, Gio.ActionGroup>("actionGroups", "GActionGroup", {
                attach: (widget, group, info) =>
                    widget.insertActionGroup((info.props.prefix as string | null) ?? "", group),
                detach: (widget, _group, info) =>
                    widget.insertActionGroup((info.props.prefix as string | null) ?? "", null),
            }),
        ],
    },
    GtkBox: { props: internal("ChildrenProps"), behaviors: [boxSlot<Gtk.Box>()] },
    GtkListBox: {
        props: internal("ChildrenProps"),
        behaviors: [
            wrappingIndexedSlot(Gtk.ListBoxRow, (row, inner) => {
                row.setChild(inner);
            }),
        ],
    },
    GtkFlowBox: {
        props: internal("ChildrenProps"),
        behaviors: [
            wrappingIndexedSlot(Gtk.FlowBoxChild, (child, inner) => {
                child.setChild(inner);
            }),
        ],
    },
    GtkOverlay: {
        props: internal("GtkOverlayProps"),
        behaviors: [
            childSetterSlot<Gtk.Overlay>(),
            slot<Gtk.Overlay, Gtk.Widget>("overlays", "GtkWidget", {
                attach: (overlay, child) => overlay.addOverlay(child),
                detach: (overlay, child) => overlay.removeOverlay(child),
                resolve: layoutChild,
            }),
        ],
    },
    GtkShortcutController: {
        props: internal("GtkShortcutControllerProps"),
        behaviors: [
            addRemoveSlot<Gtk.Shortcut, Gtk.ShortcutController>(
                "shortcuts",
                "GtkShortcut",
                (controller, shortcut) => {
                    controller.addShortcut(shortcut);
                },
                (controller, shortcut) => {
                    controller.removeShortcut(shortcut);
                },
            ),
        ],
    },
    GtkTextView: {
        props: internal("ChildrenProps"),
        behaviors: [
            slot<Gtk.TextView, Gtk.TextBuffer>("children", "GtkTextBuffer", {
                attach: (view, buffer) => view.setBuffer(buffer),
                detach: (view) => view.setBuffer(null),
            }),
        ],
    },
    GActionMap: {
        props: internal("GActionMapProps"),
        behaviors: [
            slot<Gio.ActionMap, Gio.Action>("actions", "GAction", {
                attach: (map, action) => map.addAction(action),
                detach: (map, _action, info) => map.removeAction((info.props.name as string | null) ?? ""),
            }),
        ],
    },
    GMenu: {
        props: internal("GMenuProps"),
        behaviors: [
            list<Gio.Menu, MenuItem>("items", {
                clear: (menu) => menu.removeAll(),
                add: (menu, item) => appendMenuItem(menu, item),
            }),
        ],
    },
    GtkColumnView: {
        props: internal("ChildrenProps"),
        behaviors: [
            slot<Gtk.ColumnView, Gtk.ColumnViewColumn>("children", "GtkColumnViewColumn", {
                attach: (view, column, info) => view.insertColumn(info.index, column),
                detach: (view, column) => view.removeColumn(column),
            }),
        ],
    },
    GtkGrid: {
        props: internal("ChildrenProps"),
        behaviors: [
            slot<Gtk.Grid, Gtk.Widget>("children", "GtkWidget", {
                attach: (grid, child) => grid.attach(child, 0, 0, 1, 1),
                detach: (grid, child) => grid.remove(child),
                resolve: layoutChild,
            }),
        ],
    },
    GtkFixed: {
        props: internal("ChildrenProps"),
        behaviors: [
            slot<Gtk.Fixed, Gtk.Widget>("children", "GtkWidget", {
                attach: (fixed, child) => fixed.put(child, 0, 0),
                detach: (fixed, child) => fixed.remove(child),
                resolve: layoutChild,
            }),
        ],
    },
    GtkSizeGroup: {
        props: internal("GtkSizeGroupProps"),
        behaviors: [
            list<Gtk.SizeGroup, Gtk.Widget>("widgets", {
                add: (group, widget) => group.addWidget(widget),
                remove: (group, widget) => group.removeWidget(widget),
            }),
        ],
    },
    GtkConstraintLayout: {
        props: internal("GtkConstraintLayoutProps"),
        behaviors: [
            addRemoveSlot<Gtk.Constraint, Gtk.ConstraintLayout>(
                "constraints",
                "GtkConstraint",
                (layout, constraint) => {
                    layout.addConstraint(constraint);
                },
                (layout, constraint) => {
                    layout.removeConstraint(constraint);
                },
            ),
            addRemoveSlot<Gtk.ConstraintGuide, Gtk.ConstraintLayout>(
                "guides",
                "GtkConstraintGuide",
                (layout, guide) => {
                    layout.addGuide(guide);
                },
                (layout, guide) => {
                    layout.removeGuide(guide);
                },
            ),
            list<Gtk.ConstraintLayout, VflConstraints, Gtk.Constraint[]>("vfl", {
                add: (layout, item) => [
                    ...layout.addConstraintsFromDescription(
                        item.lines,
                        item.hspacing ?? 0,
                        item.vspacing ?? 0,
                        item.views ?? new Map(),
                    ),
                ],
                remove: (layout, _item, constraints) => {
                    for (const constraint of constraints) layout.removeConstraint(constraint);
                },
            }),
        ],
    },
    GtkStack: {
        props: internal("ChildrenProps"),
        behaviors: [
            adoptedChildrenSlot<Gtk.Stack, Gtk.Widget>(
                "GtkWidget",
                (stack, child) => stack.addChild(child),
                (stack, child) => {
                    stack.remove(child);
                },
            ),
            deferred<Gtk.Stack, string>("visibleChildName", (stack, name) => stack.getChildByName(name) !== null),
        ],
    },
    GtkNotebook: {
        props: internal("ChildrenProps"),
        behaviors: [
            slot<Gtk.Notebook, Gtk.Widget>("children", "GtkWidget", {
                attach: (notebook, child, info) => notebook.insertPage(child, null, info.index),
                reorder: (notebook, child, info) => notebook.reorderChild(child, info.index),
                detach: (notebook, child) => notebook.detachTab(child),
                resolve: (notebook, child) => notebook.getPage(child),
            }),
        ],
    },
    GtkApplication: {
        props: internal("GtkApplicationProps"),
        component: internal("createApplicationComponent"),
        behaviors: [
            addRemoveSlot<Gtk.Window, Gtk.Application>(
                "children",
                "GtkWindow",
                (application, window) => {
                    application.addWindow(window);
                },
                (application, window) => {
                    application.removeWindow(window);
                },
            ),
            list<Gtk.Application, ActionAccel>("actionAccels", {
                add: (application, item) => application.setAccelsForAction(item.detailedActionName, item.accels),
                remove: (application, item) => application.setAccelsForAction(item.detailedActionName, []),
            }),
        ],
    },
    GtkAboutDialog: {
        props: internal("GtkAboutDialogProps"),
        behaviors: [
            list<Gtk.AboutDialog, CreditSection>("creditSections", {
                add: (dialog, section) => dialog.addCreditSection(section.sectionName, section.people),
            }),
        ],
    },
    GtkScale: {
        props: internal("GtkScaleProps"),
        behaviors: [
            list<Gtk.Scale, ScaleMark>("marks", {
                add: (scale, mark) => scale.addMark(mark.value ?? 0, mark.position, mark.markup ?? null),
                clear: (scale) => scale.clearMarks(),
            }),
        ],
    },
    GtkCalendar: {
        props: internal("GtkCalendarProps"),
        behaviors: [
            list<Gtk.Calendar, number>("markedDays", {
                add: (calendar, day) => calendar.markDay(day),
                clear: (calendar) => calendar.clearMarks(),
            }),
        ],
    },
    GtkLevelBar: {
        props: internal("GtkLevelBarProps"),
        behaviors: [
            list<Gtk.LevelBar, LevelBarOffset>("offsets", {
                add: (bar, offset) => bar.addOffsetValue(offset.name, offset.value ?? 0),
                remove: (bar, offset) => bar.removeOffsetValue(offset.name),
            }),
        ],
    },
    GtkDropTarget: {
        props: internal("GtkDropTargetProps"),
        behaviors: [
            value<Gtk.DropTarget, GObject.Type[]>("types", (target, types) => {
                target.setGtypes(types);
            }),
        ],
    },
    GtkDrawingArea: {
        props: internal("GtkDrawingAreaProps"),
        behaviors: [
            value<Gtk.DrawingArea, Gtk.DrawingAreaDrawFunc>("drawFunc", (area, draw) => {
                area.setDrawFunc(draw);
                area.queueDraw();
            }),
        ],
    },
    GtkDragSource: {
        props: internal("GtkDragSourceProps"),
        behaviors: [
            value<Gtk.DragSource, DragSourceIcon>("icon", (source, icon) => {
                source.setIcon(icon.paintable ?? null, icon.hotX ?? 0, icon.hotY ?? 0);
            }),
        ],
    },
    GtkEditable: { behaviors: [controlledText("text")] },
};

registerElements(BUILTIN_ELEMENTS);
