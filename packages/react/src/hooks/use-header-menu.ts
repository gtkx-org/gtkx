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

/**
 * Renders a column's `headerMenu` subtree offscreen and installs its menu model on the column.
 *
 * The `headerMenu` prop is a rendered menu subtree (for example a `<GMenu>` element), not a
 * `Gio.MenuModel` value. It is portalled into an offscreen container so the reconciler builds the
 * concrete `Gio.MenuModel`; after each commit the resulting model is read back and applied to the
 * column through `setHeaderMenu`. When the prop is absent the column's header menu is cleared to
 * `null`. The returned node must be rendered so the offscreen subtree mounts.
 *
 * @param column - The column whose header menu to manage, or `null` while it is still resolving.
 * @param headerMenu - The menu subtree to render, or `undefined`/`null` for no header menu.
 * @returns The offscreen portal element to render, or `null` when there is no header menu.
 */
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
