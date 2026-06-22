import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { createPortal } from "../reconciler/portal.js";
import { stateOf } from "../reconciler/state.js";

const findMenuModel = (container: GObject.Object): Gio.MenuModel | null => {
    for (const child of stateOf(container).children) {
        if (child instanceof Gio.MenuModel) return child;
    }
    return null;
};

export const useHeaderMenu = (column: Gtk.ColumnViewColumn | null, headerMenu: ReactNode): ReactNode => {
    const containerRef = useRef<GObject.Object | null>(null);
    if (containerRef.current === null) {
        containerRef.current = new GObject.Object();
    }
    const container = containerRef.current;

    useLayoutEffect(() => {
        if (column === null) return;
        if (headerMenu === undefined || headerMenu === null) {
            column.setHeaderMenu(null);
            return;
        }
        column.setHeaderMenu(findMenuModel(container));
    });

    if (headerMenu === undefined || headerMenu === null) return null;
    return createPortal(headerMenu, container, "header-menu");
};
