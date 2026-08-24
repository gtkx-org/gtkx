import type * as GObject from "@gtkx/gi/gobject";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import type {
    ActionAccel,
    CreditSection,
    DragSourceIcon,
    LevelBarOffset,
    MainOption,
    MenuItem,
    ScaleMark,
    VflConstraints,
} from "./prop-types.js";
import { BUILTIN_ELEMENTS, SINGLE_CHILD_TYPES } from "./element-config.js";
import {
    addRemoveSlot,
    adoptedChildrenSlot,
    applicationCreator,
    boxSlot,
    childSetterSlot,
    controlledText,
    deferred,
    list,
    slot,
    value,
    wrappingIndexedSlot,
} from "./reconciler/behaviors.js";
import { runWithErrorReporter } from "./reconciler/commit-errors.js";
import {
    type ElementBehavior,
    type ElementConfig,
    forTypes,
    type Props,
    registerElements,
} from "./reconciler/registry.js";
import { applyWrite } from "./reconciler/signals.js";
import { applyStyle, CSS_CLASSES_PROP, styleClass, validateStyle } from "./reconciler/style.js";

type SelectedIndexState = {
    desired: number | undefined;
    isScheduled: boolean;
    disconnect: (() => void) | null;
    reportError: ((error: unknown) => void) | null;
};

const SELECTED_INDEX_PROP = "selectedIndex";
const SELECTION_SIGNAL = "selected-rows-changed";
const NO_SELECTION = -1;

const BUILTIN_BEHAVIORS: Record<string, ElementConfig<never>> = {
    ...forTypes(SINGLE_CHILD_TYPES, {
        behaviors: [childSetterSlot()],
    }),
    ...forTypes(["GtkHeaderBar", "GtkActionBar"], {
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
        behaviors: [childSetterSlot()],
    },
    GtkWidget: {
        behaviors: [
            slot<Gtk.Widget, Gtk.Popover>("children", "GtkPopover", {
                attach: (parent, popover) => {
                    popover.setParent(parent);
                },
                detach: (_parent, popover) => {
                    popover.unparent();
                },
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
                attach: (widget, manager) => {
                    widget.setLayoutManager(manager);
                },
                detach: (widget) => {
                    widget.setLayoutManager(null);
                },
            }),
            slot<Gtk.Widget, Gio.ActionGroup>("actionGroups", "GActionGroup", {
                attach: (widget, group, info) => {
                    widget.insertActionGroup((info.props.prefix as string | null) ?? "", group);
                },
                detach: (widget, _group, info) => {
                    widget.insertActionGroup((info.props.prefix as string | null) ?? "", null);
                },
            }),
            styleBehavior(),
        ],
    },
    GtkBox: {
        behaviors: [boxSlot<Gtk.Box>()],
    },
    GtkListBox: {
        behaviors: [
            wrappingIndexedSlot(Gtk.ListBoxRow, (row, inner) => {
                row.setChild(inner);
            }),
            selectedIndexBehavior(),
        ],
    },
    GtkFlowBox: {
        behaviors: [
            wrappingIndexedSlot(Gtk.FlowBoxChild, (child, inner) => {
                child.setChild(inner);
            }),
        ],
    },
    GtkOverlay: {
        behaviors: [
            childSetterSlot<Gtk.Overlay>(),
            slot<Gtk.Overlay, Gtk.Widget>("overlays", "GtkWidget", {
                attach: (overlay, child) => {
                    overlay.addOverlay(child);
                },
                detach: (overlay, child) => {
                    overlay.removeOverlay(child);
                },
                resolve: layoutChild,
            }),
        ],
    },
    GtkShortcutController: {
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
    GtkTextChildAnchor: {
        behaviors: [{ create: () => Gtk.TextChildAnchor.new() }],
    },
    GtkTextView: {
        behaviors: [
            slot<Gtk.TextView, Gtk.TextBuffer>("children", "GtkTextBuffer", {
                attach: (view, buffer) => {
                    view.setBuffer(buffer);
                },
                detach: (view) => {
                    view.setBuffer(null);
                },
            }),
        ],
    },
    GActionMap: {
        behaviors: [
            slot<Gio.ActionMap, Gio.Action>("actions", "GAction", {
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
            list<Gio.Menu, MenuItem>("items", {
                clear: (menu) => {
                    menu.removeAll();
                },
                add: (menu, item) => {
                    appendMenuItem(menu, item);
                },
            }),
        ],
    },
    GtkColumnView: {
        behaviors: [
            slot<Gtk.ColumnView, Gtk.ColumnViewColumn>("children", "GtkColumnViewColumn", {
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
            slot<Gtk.Grid, Gtk.Widget>("children", "GtkWidget", {
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
            slot<Gtk.Fixed, Gtk.Widget>("children", "GtkWidget", {
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
                        item.views ?? new Map<string, Gtk.ConstraintTarget>(),
                    ),
                ],
                remove: (layout, _item, constraints) => {
                    for (const constraint of constraints) {
                        layout.removeConstraint(constraint);
                    }
                },
            }),
        ],
    },
    GtkStack: {
        behaviors: [
            adoptedChildrenSlot<Gtk.Stack, Gtk.Widget>(
                "GtkWidget",
                (stack, child) => stack.addChild(child),
                (stack, child) => {
                    stack.remove(child);
                },
            ),
            deferred<Gtk.Stack, "string">(
                "visibleChildName",
                "string",
                (stack, name) => name === null || stack.getChildByName(name) !== null,
            ),
        ],
    },
    GtkNotebook: {
        behaviors: [
            slot<Gtk.Notebook, Gtk.Widget>("children", "GtkWidget", {
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
            value<Gtk.DrawingArea, Gtk.DrawingAreaDrawFunc>("drawFunc", (area, draw) => {
                area.setDrawFunc(draw);
                area.queueDraw();
            }),
        ],
    },
    GtkDragSource: {
        behaviors: [
            value<Gtk.DragSource, DragSourceIcon>("icon", (source, icon) => {
                source.setIcon(icon.paintable ?? null, icon.hotX ?? 0, icon.hotY ?? 0);
            }),
        ],
    },
    GtkEditable: {
        behaviors: [controlledText("text")],
    },
};

function layoutChild(parent: Gtk.Widget, child: Gtk.Widget): GObject.Object | null {
    return parent.getLayoutManager()?.getLayoutChild(child) ?? null;
}

const isNullish = (value: unknown): boolean => value === undefined || value === null;
const isInitialNull = (prevValue: unknown, value: unknown): boolean => value === null && prevValue === undefined;

const styleClassValue = (value: unknown): string => {
    if (typeof value !== "string") {
        throw new TypeError("Every 'cssClasses' item must be a string");
    }

    return value;
};

const withStyleClass = (classes: unknown, className: string): string[] => {
    if (classes === undefined || classes === null) {
        return [className];
    }

    if (!Array.isArray(classes)) {
        throw new TypeError("The 'cssClasses' prop must be an array, null, or undefined");
    }

    return [...classes.map((value) => styleClassValue(value)), className];
};

const hasCssClassesChange = (prev: Props, next: Props): boolean => {
    const classes = next.cssClasses;

    if (classes === undefined || Object.is(prev.cssClasses, classes)) {
        return false;
    }

    return !isInitialNull(prev.cssClasses, classes);
};

const didWriteCssClasses = (widget: Gtk.Widget, prev: Props, next: Props, className: string | null): boolean => {
    if (className === null || !hasCssClassesChange(prev, next)) {
        return false;
    }

    applyWrite(CSS_CLASSES_PROP, () => {
        Reflect.set(widget, CSS_CLASSES_PROP, withStyleClass(next.cssClasses, className));
    });

    return true;
};

const isRestyled = (prev: Props, next: Props): boolean => {
    if (isNullish(prev.style) && isNullish(next.style)) {
        return false;
    }

    return !Object.is(prev.style, next.style);
};

function updateStyle(widget: Gtk.Widget, prev: Props, next: Props): Iterable<string> | undefined {
    const isChanged = isRestyled(prev, next);
    const className = isChanged ? applyStyle(widget, next.style) : styleClass(widget);

    if (!isChanged && className === null) {
        return;
    }

    return didWriteCssClasses(widget, prev, next, className) ? ["style", "cssClasses"] : ["style"];
}

function validateStyleProps(_widget: Gtk.Widget, _prev: Props, next: Props): void {
    validateStyle(next.style);

    if (next.style !== undefined && next.style !== null) {
        withStyleClass(next.cssClasses, `${CSS_CLASSES_PROP}-validation`);
    }
}

function styleBehavior(): ElementBehavior<Gtk.Widget> {
    return { validate: validateStyleProps, update: updateStyle };
}

function selectedRowIndex(box: Gtk.ListBox): number {
    return box.getSelectedRow()?.getIndex() ?? NO_SELECTION;
}

function selectedIndexError(value: unknown): Error {
    return new Error(
        "The 'selectedIndex' of a <GtkListBox> must be a whole number, or -1 to select no row; " +
        `received ${String(value)}.`,
    );
}

function desiredIndex(value: unknown): number | undefined {
    if (value === undefined) {
        return undefined;
    }

    if (value === null) {
        return NO_SELECTION;
    }

    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < NO_SELECTION) {
        throw selectedIndexError(value);
    }

    return value;
}

function selectRowAt(box: Gtk.ListBox, row: Gtk.ListBoxRow): void {
    applyWrite(SELECTED_INDEX_PROP, () => {
        box.selectRow(row);
    });
}

function clearSelection(box: Gtk.ListBox): void {
    applyWrite(SELECTED_INDEX_PROP, () => {
        box.unselectAll();
    });
}

function applySelectedIndex(box: Gtk.ListBox, state: SelectedIndexState): void {
    const { desired } = state;

    if (desired === undefined || selectedRowIndex(box) === desired) {
        return;
    }

    if (desired < 0) {
        clearSelection(box);

        return;
    }

    const row = box.getRowAtIndex(desired);

    if (row !== null) {
        selectRowAt(box, row);
    }
}

function scheduleSelectedIndex(box: Gtk.ListBox, state: SelectedIndexState): void {
    if (state.isScheduled) {
        return;
    }

    state.isScheduled = true;

    queueMicrotask(() => {
        state.isScheduled = false;

        if (state.disconnect !== null) {
            runWithErrorReporter(state.reportError, () => {
                applySelectedIndex(box, state);
            });
        }
    });
}

function watchSelectionDrift(box: Gtk.ListBox, state: SelectedIndexState): void {
    if (state.disconnect !== null) {
        return;
    }

    const handler = (): undefined => {
        scheduleSelectedIndex(box, state);
    };

    box.on(SELECTION_SIGNAL, handler);

    state.disconnect = (): void => {
        box.off(SELECTION_SIGNAL, handler);
    };
}

function selectedIndexBehavior(): ElementBehavior<Gtk.ListBox> {
    return {
        deferred: [SELECTED_INDEX_PROP],
        initialize: (): SelectedIndexState => ({
            desired: undefined,
            isScheduled: false,
            disconnect: null,
            reportError: null,
        }),
        validate: (_box, _prev, next) => {
            desiredIndex(next[SELECTED_INDEX_PROP]);
        },
        update: (_box, _prev, next, context) => {
            (context as SelectedIndexState).desired = desiredIndex(next[SELECTED_INDEX_PROP]);

            return [SELECTED_INDEX_PROP];
        },
        flush: (box, context, reportError) => {
            const state = context as SelectedIndexState;
            state.reportError = reportError;
            applySelectedIndex(box, state);
            watchSelectionDrift(box, state);
        },
        teardown: (_box, context) => {
            const state = context as SelectedIndexState;
            state.disconnect?.();
            state.disconnect = null;
            state.reportError = null;
        },
    };
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

const buildMenu = (items: MenuItem[]): Gio.Menu => {
    const menu = Gio.Menu.new();

    for (const item of items) {
        appendMenuItem(menu, item);
    }

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

registerElements(BUILTIN_ELEMENTS);
registerElements(BUILTIN_BEHAVIORS);
