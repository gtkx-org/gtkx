import * as Adw from "@gtkx/gi/adw";
import type * as Gdk from "@gtkx/gi/gdk";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { emitSignal, t } from "@gtkx/runtime";
import { getObjectProperty } from "@gtkx/runtime/internal";
import { ancestorFor } from "../traversal.js";
import { getWidgetTypeName } from "../widget-getters.js";

const TAB_TYPE_NAME = "AdwTab";
const VALUE_T = t.boxed("GValue", { sharedLibrary: "libgobject-2.0.so.0", getTypeFnName: "g_value_get_type" });
const DRAG_ACTION_T = t.flags("libgtk-4.so.1", "gdk_drag_action_get_type", false);
const THUMBNAIL_TYPE_NAME = "AdwTabThumbnail";

type TabViewTab = { view: Adw.TabView; page: Adw.TabPage; isThumbnail: boolean };

const tabViewTabFor = (widget: Gtk.Widget): TabViewTab | null => {
    const type = getWidgetTypeName(widget);

    if (type !== TAB_TYPE_NAME && type !== THUMBNAIL_TYPE_NAME) {
        return null;
    }

    const view = getObjectProperty(widget, "view");
    const page = getObjectProperty(widget, "page");

    return view instanceof Adw.TabView && page instanceof Adw.TabPage
        ? { view, page, isThumbnail: type === THUMBNAIL_TYPE_NAME }
        : null;
};

const isTabViewTab = (widget: Gtk.Widget): boolean => tabViewTabFor(widget) !== null;

const applyTabViewClick = (widget: Gtk.Widget): void => {
    const tab = tabViewTabFor(widget);

    if (tab === null) {
        return;
    }

    tab.view.setSelectedPage(tab.page);

    if (tab.isThumbnail) {
        ancestorFor(widget, Adw.TabOverview)?.setOpen(false);
    }
};

const emitTabViewExtraDrop = (widget: Gtk.Widget, value: GObject.Value, action: Gdk.DragAction): boolean =>
    emitSignal(
        widget,
        "extra-drag-drop",
        [
            { type: VALUE_T, value },
            { type: DRAG_ACTION_T, value: action },
        ],
        t.boolean,
    ) === true;

export { applyTabViewClick, emitTabViewExtraDrop, isTabViewTab };
