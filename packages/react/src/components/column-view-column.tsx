import type * as Gtk from "@gtkx/gi/gtk";
import { createElement, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useColumnViewContext } from "../contexts/column-view-context.js";
import { useHeaderMenu } from "../hooks/use-header-menu.js";
import { type FactoryBinding, useRealizedSlots } from "../hooks/use-realized-slots.js";
import { createElementComponent } from "../utils/create-element-component.js";
import type { ColumnViewColumnProps } from "../utils/element-props.js";
import { ListPortalHost } from "./list-portal-host.js";
import type { SlotRenderer } from "./list-slot.js";

const COLUMN_ELEMENT = "GtkColumnViewColumn";

const ColumnElement = createElementComponent<Record<string, unknown>>(COLUMN_ELEMENT);

const factoryBinding: FactoryBinding<Gtk.ColumnViewColumn> = {
    install: (column, factory) => column.setFactory(factory),
    uninstall: (column) => column.setFactory(null),
};

export const GtkColumnViewColumn = <T = unknown>(props: ColumnViewColumnProps<T>): ReactNode => {
    const { id, title, expand, resizable, fixedWidth, visible, sortable, renderCell, headerMenu } = props;
    const context = useColumnViewContext();
    const [column, setColumn] = useState<Gtk.ColumnViewColumn | null>(null);

    const captureColumn = useRef((value: Gtk.ColumnViewColumn | null) => {
        setColumn(value);
    }).current;

    const { store } = useRealizedSlots<Gtk.ColumnViewColumn>({
        target: column,
        binding: factoryBinding,
    });

    const registerRef = useRef(context.register);
    registerRef.current = context.register;
    const unregisterRef = useRef(context.unregister);
    unregisterRef.current = context.unregister;

    useLayoutEffect(() => {
        if (column === null) return;
        registerRef.current({ id, column, sortable: sortable ?? false });
        return () => unregisterRef.current(id);
    }, [column, id, sortable]);

    const headerMenuPortal = useHeaderMenu(column, headerMenu);

    const slotRenderer: SlotRenderer<unknown, unknown> = (value, _treeRow, isHeader) =>
        isHeader ? null : renderCell(value as T);

    const intrinsicProps: Record<string, unknown> = { id, title, ref: captureColumn };
    if (expand !== undefined) intrinsicProps["expand"] = expand;
    if (resizable !== undefined) intrinsicProps["resizable"] = resizable;
    if (fixedWidth !== undefined) intrinsicProps["fixedWidth"] = fixedWidth;
    if (visible !== undefined) intrinsicProps["visible"] = visible;

    return (
        <>
            {createElement(ColumnElement, intrinsicProps)}
            <ListPortalHost store={store} resolver={context.resolver} render={slotRenderer} />
            {headerMenuPortal}
        </>
    );
};
