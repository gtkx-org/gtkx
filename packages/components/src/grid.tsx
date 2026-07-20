import type * as Gtk from "@gtkx/gi/gtk";
import { GtkGrid, type GtkGridProps } from "@gtkx/jsx/gtk";
import { useMergedRef } from "@gtkx/react/internal";
import { Children, type ElementType, type ReactNode, type Ref, useRef } from "react";
import { createParentContext, usePlacedChild } from "./hooks/use-placed-child.js";
import type { ChildProps } from "./types.js";

const { Context: GridContext, useParentRef: useGridRef } = createParentContext<Gtk.Grid>(
    "<Grid.Child> must be a child of <Grid>",
);

/** Props for {@link Grid}. */
export type GridProps = GtkGridProps & { ref?: Ref<Gtk.Grid | null>; children?: ReactNode };

export type GridPlacement = {
    column?: number | null | undefined;
    row?: number | null | undefined;
    /** Number of columns the child spans (defaults to 1). */
    columnSpan?: number | null | undefined;
    /** Number of rows the child spans (defaults to 1). */
    rowSpan?: number | null | undefined;
};

/** Places a single child inside a {@link Grid} at a column and row, optionally spanning multiple cells. */
export type GridChildProps<C extends ElementType> = ChildProps<C, GridPlacement>;

type Placement = { column: number; row: number; columnSpan: number; rowSpan: number };

const placementOf = (props: GridPlacement): Placement => ({
    column: props.column ?? 0,
    row: props.row ?? 0,
    columnSpan: props.columnSpan ?? 1,
    rowSpan: props.rowSpan ?? 1,
});

const samePlacement = (a: Placement, b: Placement): boolean =>
    a.column === b.column && a.row === b.row && a.columnSpan === b.columnSpan && a.rowSpan === b.rowSpan;

const GridChild = <C extends ElementType>({
    component,
    column,
    row,
    columnSpan,
    rowSpan,
    ref,
    ...rest
}: GridChildProps<C>): ReactNode => {
    const gridRef = useGridRef();
    const Component: ElementType = component;
    return usePlacedChild<Gtk.Widget, Placement>({
        render: (placeRef) => <Component {...rest} ref={placeRef} />,
        ref,
        placement: placementOf({ column, row, columnSpan, rowSpan }),
        samePlacement,
        place: (widget, placement, previous) => {
            const grid = gridRef.current;
            if (!grid) return;
            if (previous !== undefined && widget.getParent() === grid) grid.remove(widget);
            if (widget.getParent() !== grid) {
                grid.attach(widget, placement.column, placement.row, placement.columnSpan, placement.rowSpan);
            }
        },
        release: (widget) => {
            const grid = gridRef.current;
            if (grid && widget.getParent() === grid) grid.remove(widget);
        },
    });
};

/**
 * Renders a Gtk.Grid whose children are attached at explicit column/row positions via
 * {@link Grid.Child}.
 */
export const Grid: ((props: GridProps) => ReactNode) & {
    Child: <C extends ElementType>(props: GridChildProps<C>) => ReactNode;
} = Object.assign(
    ({ children, ref, ...rest }: GridProps): ReactNode => {
        const gridRef = useRef<Gtk.Grid | null>(null);
        const mergedRef = useMergedRef<Gtk.Grid>(ref, gridRef);
        return (
            <>
                <GtkGrid {...rest} ref={mergedRef} />
                <GridContext.Provider value={gridRef}>{Children.toArray(children)}</GridContext.Provider>
            </>
        );
    },
    { Child: GridChild },
);
