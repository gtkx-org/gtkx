import type { ElementType, ReactNode } from "react";
import * as Gio from "@gtkx/gi/gio";
import type { MenuItemProps, MenuProps } from "../prop-types.js";
import { createElementComponent } from "./element.js";

const createMenuItemComponent = (Component: ElementType): ((props: MenuItemProps) => ReactNode) =>
    ({ label = null, action = null, ...props }): ReactNode => <Component {...props} label={label} action={action} />;

const Item = createMenuItemComponent(createElementComponent<MenuItemProps>("GMenuItem", Gio.MenuItem));

const createMenuComponent = (Component: ElementType): ((props: MenuProps) => ReactNode) => {
    const Menu = ({ items, children, ...props }: MenuProps): ReactNode => (
        <Component {...props}>
            {items?.map((item, index) => (
                <Item
                    key={`${String(index)}:${JSON.stringify(item)}`}
                    label={item.label ?? null}
                    action={item.submenu === undefined && item.section === undefined ? item.action ?? null : null}
                    submenu={item.submenu === undefined ? undefined : <Menu items={item.submenu} />}
                    section={item.submenu === undefined && item.section !== undefined
                        ? <Menu items={item.section} />
                        : undefined}
                />
            ))}
            {children}
        </Component>
    );

    return Menu;
};

export { createMenuComponent, createMenuItemComponent };
