import type * as Gtk from "@gtkx/gi/gtk";
import { GtkGrid } from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import type { ElementType, ReactNode, Ref } from "react";
import { createContext } from "react";
import {
    createPlacedRoot,
    type PlacedChildren,
    type PlacedOps,
    usePlacedChildEffects,
    useRequiredContext,
} from "./internal/placed-children.js";
import { useLatest } from "./internal/use-latest.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";
import type { GridChildProps, GridProps } from "./types.js";

type GridCell = {
    column: number;
    row: number;
    columnSpan: number;
    rowSpan: number;
};

const GridContext = createContext<PlacedChildren<GridCell> | null>(null);

const gridOps = (grid: { current: Gtk.Grid | null }): PlacedOps<GridCell> => {
    const attach = (widget: Gtk.Widget, cell: GridCell): void => {
        grid.current?.attach(widget, cell.column, cell.row, cell.columnSpan, cell.rowSpan);
    };
    const detach = (widget: Gtk.Widget): void => {
        grid.current?.remove(widget);
    };
    return {
        attach,
        detach,
        update: (widget, cell) => {
            detach(widget);
            attach(widget, cell);
        },
    };
};

type GridChildRuntimeProps = {
    component: ElementType;
    column?: number | null | undefined;
    row?: number | null | undefined;
    columnSpan?: number | null | undefined;
    rowSpan?: number | null | undefined;
    ref?: Ref<Gtk.Widget | null> | undefined;
} & Record<string, unknown>;

const GridChildImpl = (props: GridChildRuntimeProps): ReactNode => {
    const controller = useRequiredContext(GridContext, "<Grid.Child> must be a child of <Grid>");
    const { component: Component, column, row, columnSpan, rowSpan, ref, ...rest } = props;
    const [widget, refCallback] = useWidgetRef<Gtk.Widget>(ref);
    const cell = useLatest<GridCell>({
        column: column ?? 0,
        row: row ?? 0,
        columnSpan: columnSpan ?? 1,
        rowSpan: rowSpan ?? 1,
    });
    const { column: columnValue, row: rowValue, columnSpan: columnSpanValue, rowSpan: rowSpanValue } = cell.current;
    usePlacedChildEffects(
        controller,
        widget,
        () => cell.current,
        `${columnValue}:${rowValue}:${columnSpanValue}:${rowSpanValue}`,
    );
    return createPortal(<Component {...rest} ref={refCallback} />, rootElement);
};

const GridChild = GridChildImpl as <C extends ElementType>(props: GridChildProps<C>) => ReactNode;

const GridRoot = createPlacedRoot<Gtk.Grid, GridCell>({ element: GtkGrid, context: GridContext, ops: gridOps }) as (
    props: GridProps,
) => ReactNode;

type GridComponent = ((props: GridProps) => ReactNode) & {
    Child: <C extends ElementType>(props: GridChildProps<C>) => ReactNode;
};

/** Renders a GtkGrid whose children are placed at explicit cells through {@link Grid.Child}. */
export const Grid: GridComponent = Object.assign(GridRoot, { Child: GridChild });
