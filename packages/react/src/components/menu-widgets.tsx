import type { GtkMenuButtonProps, GtkPopoverMenuBarProps, GtkPopoverMenuProps } from "@gtkx/react-gi/gtk";
import type { ReactNode } from "react";
import { Menu } from "./menu.js";

const GtkMenuButtonElement = "GtkMenuButton" as const;
const GtkPopoverMenuElement = "GtkPopoverMenu" as const;
const GtkPopoverMenuBarElement = "GtkPopoverMenuBar" as const;
const WrapperNodeElement = "__GTKX_WRAPPER_NODE__" as const;

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
export const GtkMenuButton = ({ children, menuModel, popover, ...rest }: GtkMenuButtonProps): ReactNode => {
    const resolvedMenu = resolveMenuSlot(children, menuModel);
    return (
        <GtkMenuButtonElement {...rest}>
            {resolvedMenu != null && (
                <WrapperNodeElement kind="slot" propName="menuModel">
                    {resolvedMenu}
                </WrapperNodeElement>
            )}
            {popover != null && (
                <WrapperNodeElement kind="slot" propName="popover">
                    {popover}
                </WrapperNodeElement>
            )}
        </GtkMenuButtonElement>
    );
};

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
export const GtkPopoverMenu = ({ children, menuModel, ...rest }: GtkPopoverMenuProps): ReactNode => {
    const resolvedMenu = resolveMenuSlot(children, menuModel);
    return (
        <GtkPopoverMenuElement {...rest}>
            {resolvedMenu != null && (
                <WrapperNodeElement kind="slot" propName="menuModel">
                    {resolvedMenu}
                </WrapperNodeElement>
            )}
        </GtkPopoverMenuElement>
    );
};

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
export const GtkPopoverMenuBar = ({ children, menuModel, ...rest }: GtkPopoverMenuBarProps): ReactNode => {
    const resolvedMenu = resolveMenuSlot(children, menuModel);
    return (
        <GtkPopoverMenuBarElement {...rest}>
            {resolvedMenu != null && (
                <WrapperNodeElement kind="slot" propName="menuModel">
                    {resolvedMenu}
                </WrapperNodeElement>
            )}
        </GtkPopoverMenuBarElement>
    );
};
