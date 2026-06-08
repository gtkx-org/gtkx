import {
    GtkMenuButton as GtkMenuButtonCompound,
    GtkPopoverMenuBar as GtkPopoverMenuBarCompound,
    GtkPopoverMenu as GtkPopoverMenuCompound,
} from "@gtkx/react-jsx/compounds";
import type { GtkMenuButtonProps, GtkPopoverMenuBarProps, GtkPopoverMenuProps } from "@gtkx/react-jsx/jsx";
import type { ReactNode } from "react";
import { Menu } from "./menu.js";

/**
 * Resolves the menu slot value: an explicit `menuModel` takes precedence;
 * otherwise menu-marker children are wrapped in a {@link Menu}.
 *
 * @param children - The menu-marker children, or `undefined`.
 * @param menuModel - An explicit menu model node, or `undefined`.
 * @returns The resolved menu slot node, or `null` when neither is present.
 */
const resolveMenuSlot = (children: ReactNode, menuModel: ReactNode): ReactNode => {
    if (menuModel != null) return menuModel;
    if (children == null) return null;
    return <Menu>{children}</Menu>;
};

/**
 * Declarative wrapper for `Gtk.MenuButton`.
 *
 * Menu-marker children ({@link Menu} entries) are assembled into a `Gio.Menu`
 * installed as the button's `menuModel`. Their actions register on a widget-local
 * action group inserted on the button, with accelerators bound on the enclosing
 * application when present. Pass an explicit `menuModel` to take full control of
 * the model.
 *
 * @param props - Standard `Gtk.MenuButton` props.
 */
export const GtkMenuButton = ({ children, menuModel, ...rest }: GtkMenuButtonProps): ReactNode => (
    <GtkMenuButtonCompound menuModel={resolveMenuSlot(children, menuModel)} {...rest} />
);

/**
 * Declarative wrapper for `Gtk.PopoverMenu`.
 *
 * Menu-marker children ({@link Menu} entries) are assembled into a `Gio.Menu`
 * installed as the popover's `menuModel`. Their actions register on a widget-local
 * action group inserted on the popover, with accelerators bound on the enclosing
 * application when present. Pass an explicit `menuModel` to take full control of
 * the model.
 *
 * @param props - Standard `Gtk.PopoverMenu` props.
 */
export const GtkPopoverMenu = ({ children, menuModel, ...rest }: GtkPopoverMenuProps): ReactNode => (
    <GtkPopoverMenuCompound menuModel={resolveMenuSlot(children, menuModel)} {...rest} />
);

/**
 * Declarative wrapper for `Gtk.PopoverMenuBar`.
 *
 * Menu-marker children ({@link Menu} entries) are assembled into a `Gio.Menu`
 * installed as the bar's `menuModel`. Their actions register on a widget-local
 * action group inserted on the bar, with accelerators bound on the enclosing
 * application when present. Pass an explicit `menuModel` to take full control of
 * the model.
 *
 * @param props - Standard `Gtk.PopoverMenuBar` props.
 */
export const GtkPopoverMenuBar = ({ children, menuModel, ...rest }: GtkPopoverMenuBarProps): ReactNode => (
    <GtkPopoverMenuBarCompound menuModel={resolveMenuSlot(children, menuModel)} {...rest} />
);
