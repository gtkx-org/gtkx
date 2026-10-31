import { createElement, type ElementType, type ReactNode } from "react";
import * as Gio from "@gtkx/gi/gio";
import type { CustomChildrenProps, MenuItemProps, MenuProps } from "../prop-types.js";
import type { Props } from "../reconciler/registry.js";
import { createElementComponent, Prop } from "./element.js";

const CUSTOM_CHILD_SLOT_PREFIX = "customChildren.";

const customChildSlot = (id: string): string => `${CUSTOM_CHILD_SLOT_PREFIX}${id}`;

const customChildId = (slot: string): string | null =>
    slot.startsWith(CUSTOM_CHILD_SLOT_PREFIX) ? slot.slice(CUSTOM_CHILD_SLOT_PREFIX.length) : null;

const createMenuItemComponent =
    (Component: ElementType): ((props: MenuItemProps) => ReactNode) =>
    ({ label = null, action = null, ...props }): ReactNode => <Component {...props} label={label} action={action} />;

const Item = createMenuItemComponent(createElementComponent<MenuItemProps>("GMenuItem", Gio.MenuItem));

const createMenuComponent = (Component: ElementType): ((props: MenuProps) => ReactNode) => {
    const Menu = ({ items, children, ...props }: MenuProps): ReactNode => (
        <Component {...props}>
            {items?.map((item, index) => {
                const { label, action, submenu, section, ...attributes } = item;

                return (
                    <Item
                        key={`${String(index)}:${JSON.stringify(item)}`}
                        {...attributes}
                        label={label ?? null}
                        action={submenu === undefined && section === undefined ? (action ?? null) : null}
                        submenu={submenu === undefined ? undefined : <Menu items={submenu} />}
                        section={submenu === undefined && section !== undefined ? <Menu items={section} /> : undefined}
                    />
                );
            })}
            {children}
        </Component>
    );

    return Menu;
};

const createCustomChildrenComponent =
    (Component: ElementType): ((props: CustomChildrenProps & Props) => ReactNode) =>
    ({ customChildren, children, ...props }): ReactNode => (
        <Component {...props}>
            {Object.entries(customChildren ?? {}).map(([id, child]) =>
                createElement(Prop, { propName: customChildSlot(id), key: id }, child),
            )}
            {children as ReactNode}
        </Component>
    );

export { createCustomChildrenComponent, createMenuComponent, createMenuItemComponent, customChildId };
