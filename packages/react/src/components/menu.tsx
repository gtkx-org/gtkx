import type * as Gio from "@gtkx/gi/gio";
import { createElement, type ReactNode, type Ref, useLayoutEffect, useRef } from "react";
import { useForwardedRef } from "../hooks/use-forwarded-ref.js";
import { createElementComponent } from "../utils/create-element-component.js";
import type { MenuEntry } from "../utils/element-props.js";
import { applyMenuItems, menuItemsEqual } from "./menu-items.js";

const GMenuElement = createElementComponent<Record<string, unknown>>("GMenu");

export type MenuProps = {
    items?: MenuEntry[] | null;
    ref?: Ref<Gio.Menu | null>;
};

export const GMenu = (props: MenuProps): ReactNode => {
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

    return createElement(GMenuElement, { ...rest, ref: mergedRef });
};
