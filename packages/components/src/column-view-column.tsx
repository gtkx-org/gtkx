import type * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnViewColumn, type GtkColumnViewColumnProps } from "@gtkx/jsx/gtk";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { type CellRenderer, CellRenderHost, itemRenderer } from "./cell.js";
import { useColumnViewContext } from "./column-view-context.js";
import { type FactoryInstaller, useCellContainers } from "./hooks/use-cell-containers.js";
import { useHeaderMenu } from "./hooks/use-header-menu.js";
import type { RenderItemInfo } from "./types.js";

const factoryInstaller: FactoryInstaller<Gtk.ColumnViewColumn> = {
    install: (column, factory) => column.setFactory(factory),
    uninstall: (column) => column.setFactory(null),
};

export type ColumnRenderItemInfo<T> = RenderItemInfo<T>;

type ColumnViewColumnDeclarativeProps<T = unknown> = {
    title: string;
    expand?: boolean | undefined;
    resizable?: boolean | undefined;
    fixedWidth?: number | undefined;
    id: string;
    sortable?: boolean | undefined;
    visible?: boolean | undefined;
    renderItem: (info: ColumnRenderItemInfo<T>) => ReactNode;
    headerMenu?: ReactNode;
};

export type ColumnViewColumnProps<T = unknown> = Omit<GtkColumnViewColumnProps, "factory" | "sorter"> &
    ColumnViewColumnDeclarativeProps<T>;

export const ColumnViewColumn = <T = unknown>(props: ColumnViewColumnProps<T>): ReactNode => {
    const { id, title, sortable, renderItem, headerMenu, ...intrinsicProps } = props as ColumnViewColumnProps<T> & {
        [key: string]: unknown;
    };
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

    const cellRenderer: CellRenderer<unknown, unknown> = itemRenderer<unknown, unknown>(({ item, index }) =>
        renderItem({ item: item as T, index }),
    );

    return (
        <>
            <GtkColumnViewColumn {...intrinsicProps} id={id} title={title} ref={captureColumn} />
            <CellRenderHost store={store} resolver={context.resolver} render={cellRenderer} />
            {headerMenuPortal}
        </>
    );
};
