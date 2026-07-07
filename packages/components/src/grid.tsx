import type * as Gtk from "@gtkx/gi/gtk";
import { GtkGrid, type GtkGridProps } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react";
import { Children, type ReactNode, type Ref, useRef } from "react";
import { createParentContext, type PlacedChildRender, usePlacedChild } from "./hooks/use-placed-child.js";

const { Context: GridContext, useParentRef: useGridRef } = createParentContext<Gtk.Grid>(
    "<Grid.Child> must be a child of <Grid>",
);

export type GridProps = GtkGridProps & { ref?: Ref<Gtk.Grid | null>; children?: ReactNode };

export type GridChildProps = {
    children: PlacedChildRender<Gtk.Widget>;
    column?: number | null | undefined;
    row?: number | null | undefined;
    columnSpan?: number | null | undefined;
    rowSpan?: number | null | undefined;
};

type Placement = { column: number; row: number; columnSpan: number; rowSpan: number };

const placementOf = (props: GridChildProps): Placement => ({
    column: props.column ?? 0,
    row: props.row ?? 0,
    columnSpan: props.columnSpan ?? 1,
    rowSpan: props.rowSpan ?? 1,
});

const samePlacement = (a: Placement, b: Placement): boolean =>
    a.column === b.column && a.row === b.row && a.columnSpan === b.columnSpan && a.rowSpan === b.rowSpan;

const GridChild = (props: GridChildProps): ReactNode => {
    const gridRef = useGridRef();
    return usePlacedChild<Gtk.Widget, Placement>({
        render: props.children,
        placement: placementOf(props),
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

export const Grid: ((props: GridProps) => ReactNode) & { Child: (props: GridChildProps) => ReactNode } = Object.assign(
    ({ children, ref, ...rest }: GridProps): ReactNode => {
        const gridRef = useRef<Gtk.Grid | null>(null);
        const mergedRef = useMergeRefs<Gtk.Grid>(ref, gridRef);
        return (
            <>
                <GtkGrid {...rest} ref={mergedRef} />
                <GridContext.Provider value={gridRef}>{Children.toArray(children)}</GridContext.Provider>
            </>
        );
    },
    { Child: GridChild },
);
