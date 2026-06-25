import type * as Gio from "@gtkx/gi/gio";
import { GMenu, type GMenuProps } from "@gtkx/jsx/gio";
import { useForwardedRef } from "@gtkx/react";
import { createElement, type ReactNode, type Ref, useLayoutEffect, useRef } from "react";
import { applyMenuItems, menuItemsEqual } from "./menu-items.js";
import type { MenuEntry } from "./types.js";

/**
 * The declarative menu-model surface added by the {@link Menu} component on top
 * of the raw `GMenu` element.
 */
export type MenuItemsProps = {
    items?: MenuEntry[] | null | undefined;
};

/**
 * Props for the {@link Menu} component: the raw `GMenu` element surface with a
 * declarative `items` model layered on top.
 */
export type MenuProps = Omit<GMenuProps, keyof MenuItemsProps> & MenuItemsProps & { ref?: Ref<Gio.Menu | null> };

/**
 * A declarative `Gio.Menu` built from an `items` tree of {@link MenuEntry}
 * values. Rebuilds the underlying menu model whenever the item structure
 * changes.
 */
export const Menu = (props: MenuProps): ReactNode => {
    const { items, ref, ...rest } = props;
    const [menuRef, mergedRef] = useForwardedRef(ref);
    const appliedRef = useRef<MenuEntry[] | null>(null);

    useLayoutEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;
        const entries = items ?? null;
        if (menuItemsEqual(appliedRef.current, entries)) return;
        appliedRef.current = entries;
        applyMenuItems(menu, entries);
    });

    return createElement(GMenu, { ...rest, ref: mergedRef });
};
