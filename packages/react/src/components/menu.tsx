import type * as Gio from "@gtkx/gi/gio";
import { createElement, type ReactNode, type Ref, useLayoutEffect, useRef } from "react";
import { useForwardedRef } from "../hooks/use-forwarded-ref.js";
import { createElementComponent } from "../utils/create-element-component.js";
import type { MenuEntry } from "../utils/element-props.js";
import { applyMenuItems, menuItemsEqual } from "./menu-items.js";

const GMenuElement = createElementComponent<Record<string, unknown>>("GMenu");

/**
 * Props for the {@link GMenu} runtime component: the menu's content as plain
 * data plus an optional ref to the live model.
 */
export type MenuProps = {
    /** The menu's entries, in order. The content rebuilds when they change. */
    items?: readonly MenuEntry[] | null;
    /** Ref to the live `Gio.Menu`. */
    ref?: Ref<Gio.Menu | null>;
};

/**
 * Declarative wrapper for `Gio.Menu`.
 *
 * The component owns the `items` data prop: `Gio.Menu` is a value-snapshot
 * model, so the content is declared as plain {@link MenuEntry} data and the
 * component rebuilds the model wholesale — sections and submenus recursively —
 * whenever the entries change (compared deeply, so content-stable inline
 * arrays never rebuild). Every other prop forwards to the underlying element.
 *
 * @example
 * ```tsx
 * <GtkMenuButton
 *     iconName="open-menu-symbolic"
 *     menuModel={
 *         <GMenu
 *             items={[
 *                 { label: "_Open", action: "win.open" },
 *                 { section: [{ label: "_Quit", action: "app.quit" }] },
 *             ]}
 *         />
 *     }
 * />
 * ```
 *
 * @param props - {@link MenuProps}, plus any generated `GMenuProps` member.
 */
export const GMenu = (props: MenuProps): ReactNode => {
    const { items, ref, ...rest } = props;
    const [menuRef, mergedRef] = useForwardedRef(ref);
    const appliedRef = useRef<readonly MenuEntry[] | null>(null);

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
