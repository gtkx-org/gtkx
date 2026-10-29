import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import { getObjectProperty } from "@gtkx/runtime/internal";
import { ancestorFor } from "../traversal.js";
import { getWidgetTypeName } from "../widget-getters.js";

const TAB_TYPE_NAME = "AdwTab";
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

export { applyTabViewClick, isTabViewTab };
