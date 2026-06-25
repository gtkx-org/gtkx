import type * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnViewColumn, type GtkColumnViewColumnProps } from "@gtkx/jsx/gtk";
import { createElement, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { type CellRenderer, CellRenderHost } from "./cell.js";
import { useColumnViewContext } from "./column-view-context.js";
import { type FactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { useHeaderMenu } from "./hooks/use-header-menu.js";

const factoryInstaller: FactoryInstaller<Gtk.ColumnViewColumn> = {
    install: (column, factory) => column.setFactory(factory),
    uninstall: (column) => column.setFactory(null),
};

/**
 * Props for a single {@link ColumnViewColumn} of a {@link ColumnView},
 * replacing the raw `GtkColumnViewColumn` factory/sorter surface with a
 * declarative `renderCell` callback and an optional header context menu.
 */
export type ColumnViewColumnDeclarativeProps<T = unknown> = {
    title: string;
    expand?: boolean | undefined;
    resizable?: boolean | undefined;
    fixedWidth?: number | undefined;
    id: string;
    sortable?: boolean | undefined;
    visible?: boolean | undefined;
    renderCell: (item: T) => ReactNode;
    headerMenu?: ReactNode;
};

/**
 * Props for the {@link ColumnViewColumn} component: the raw
 * `GtkColumnViewColumn` element surface (minus its imperative `factory` and
 * `sorter` properties) with its cell wiring replaced by the declarative
 * {@link ColumnViewColumnDeclarativeProps} API.
 */
export type ColumnViewColumnProps<T = unknown> = Omit<GtkColumnViewColumnProps, "factory" | "sorter"> &
    ColumnViewColumnDeclarativeProps<T>;

/**
 * A single column of a {@link ColumnView}, rendering each row's cell through
 * the declarative `renderCell` callback and optionally attaching a header
 * context menu.
 */
export const ColumnViewColumn = <T = unknown>(props: ColumnViewColumnProps<T>): ReactNode => {
    const { id, title, expand, resizable, fixedWidth, visible, sortable, renderCell, headerMenu } = props;
    const context = useColumnViewContext();
    const [column, setColumn] = useState<Gtk.ColumnViewColumn | null>(null);

    const captureColumn = useRef((value: Gtk.ColumnViewColumn | null) => {
        setColumn(value);
    }).current;

    const store = useCellContainers<Gtk.ColumnViewColumn>({
        target: column,
        installer: factoryInstaller,
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

    const cellRenderer: CellRenderer<unknown, unknown> = (value, _treeRow, isHeader) =>
        isHeader ? null : renderCell(value as T);

    const intrinsicProps: Record<string, unknown> = { id, title, ref: captureColumn };
    if (expand !== undefined) intrinsicProps["expand"] = expand;
    if (resizable !== undefined) intrinsicProps["resizable"] = resizable;
    if (fixedWidth !== undefined) intrinsicProps["fixedWidth"] = fixedWidth;
    if (visible !== undefined) intrinsicProps["visible"] = visible;

    return (
        <>
            {createElement(GtkColumnViewColumn, intrinsicProps)}
            <CellRenderHost store={store} resolver={context.resolver} render={cellRenderer} />
            {headerMenuPortal}
        </>
    );
};
