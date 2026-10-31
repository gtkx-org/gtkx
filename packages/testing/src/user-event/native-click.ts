import type * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { getWidgetTypeName } from "../widget-getters.js";
import { applyHeaderClick } from "./column-header-click.js";
import { applyEditableLabelClick, isEditableLabelText } from "./editable-label-click.js";
import { applyRowClick } from "./list-row-click.js";
import { applyTabClick, isNotebookTab } from "./notebook-tab-click.js";
import { applyTabViewClick, isTabViewTab } from "./tab-view-click.js";

type NativeClick = (widget: Gtk.Widget, nPress: number, modifiers: Gdk.ModifierType) => void;

const COLUMN_ROW_TYPE_NAME = "GtkColumnViewRowWidget";
const ROW_TYPE_NAMES: Set<string> = new Set([COLUMN_ROW_TYPE_NAME, "GtkListItemWidget"]);
const CELL_TYPE_NAME = "GtkColumnViewCellWidget";
const TITLE_TYPE_NAME = "GtkColumnViewTitle";
const TOGGLE_EXPAND_ACTION = "listitem.toggle-expand";

const isHeaderRow = (widget: Gtk.Widget): boolean =>
    getWidgetTypeName(widget) === COLUMN_ROW_TYPE_NAME && widget.getParent() instanceof Gtk.ColumnView;

const isClickTransparent = (widget: Gtk.Widget): boolean =>
    getWidgetTypeName(widget) === CELL_TYPE_NAME || isHeaderRow(widget);

const isExpanderToggling = (widget: Gtk.Widget): boolean =>
    widget instanceof Gtk.TreeExpander && widget.getListRow()?.isExpandable() === true && !widget.getHideExpander();

const isColumnHeader = (widget: Gtk.Widget): boolean => getWidgetTypeName(widget) === TITLE_TYPE_NAME;
const isFactoryRow = (widget: Gtk.Widget): boolean => ROW_TYPE_NAMES.has(getWidgetTypeName(widget) ?? "");

const toggleExpander = (widget: Gtk.Widget, nPress: number): void => {
    for (let press = 1; press <= nPress; press++) {
        widget.activateAction(TOGGLE_EXPAND_ACTION, null);
    }
};

const nativeClickFor = (widget: Gtk.Widget, isClicked: boolean): NativeClick | null => {
    if (isClicked && isExpanderToggling(widget)) {
        return toggleExpander;
    }

    if (isClicked && isEditableLabelText(widget)) {
        return applyEditableLabelClick;
    }

    if (isColumnHeader(widget)) {
        return applyHeaderClick;
    }

    if (isNotebookTab(widget)) {
        return applyTabClick;
    }

    if (isTabViewTab(widget)) {
        return applyTabViewClick;
    }

    return isFactoryRow(widget) ? applyRowClick : null;
};

export { isClickTransparent, type NativeClick, nativeClickFor };
