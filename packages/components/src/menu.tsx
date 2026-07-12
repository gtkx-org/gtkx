import type * as Gio from "@gtkx/gi/gio";
import { GMenu, type GMenuProps } from "@gtkx/jsx/gio";
import { useMergeRefs } from "@gtkx/react/internal";
import { type ReactNode, type Ref, useLayoutEffect, useRef } from "react";
import { applyMenuItems, menuItemsEqual } from "./menu-items.js";
import type { MenuEntry } from "./types.js";

type MenuItemsProps = {
    items?: MenuEntry[] | null | undefined;
};

/** Props for {@link Menu}, combining Gio.Menu props with a declarative items array. */
export type MenuProps = Omit<GMenuProps, keyof MenuItemsProps> & MenuItemsProps & { ref?: Ref<Gio.Menu | null> };

/** Builds a Gio.Menu model from a declarative array of {@link MenuEntry} items. */
export const Menu = (props: MenuProps): ReactNode => {
    const { items, ref, ...rest } = props;
    const menuRef = useRef<Gio.Menu | null>(null);
    const mergedRef = useMergeRefs(ref, menuRef);
    const appliedRef = useRef<MenuEntry[] | null>(null);

    useLayoutEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;
        const entries = items ?? null;
        if (menuItemsEqual(appliedRef.current, entries)) return;
        appliedRef.current = entries;
        applyMenuItems(menu, entries);
    });

    return <GMenu {...rest} ref={mergedRef} />;
};
