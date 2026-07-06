import { Grid } from "@gtkx/components";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Grid", () => {
    it("attaches children at their cells", async () => {
        const gridRef = createRef<Gtk.Grid>();

        await render(
            <Grid ref={gridRef} columnSpacing={6} rowSpacing={4}>
                <Grid.Child column={0} row={0}>
                    {(ref) => <GtkLabel ref={ref} label="A" />}
                </Grid.Child>
                <Grid.Child column={1} row={1}>
                    {(ref) => <GtkLabel ref={ref} label="B" />}
                </Grid.Child>
            </Grid>,
        );

        const grid = gridRef.current as Gtk.Grid;
        expect(grid.getColumnSpacing()).toBe(6);
        expect(grid.getRowSpacing()).toBe(4);
        expect((grid.getChildAt(0, 0) as Gtk.Label).getLabel()).toBe("A");
        expect((grid.getChildAt(1, 1) as Gtk.Label).getLabel()).toBe("B");
    });

    it("spans columns and rows", async () => {
        const gridRef = createRef<Gtk.Grid>();

        await render(
            <Grid ref={gridRef}>
                <Grid.Child column={0} row={0} columnSpan={2} rowSpan={2}>
                    {(ref) => <GtkLabel ref={ref} label="wide" />}
                </Grid.Child>
            </Grid>,
        );

        const grid = gridRef.current as Gtk.Grid;
        const label = grid.getChildAt(0, 0) as Gtk.Label;
        expect(label.getLabel()).toBe("wide");
        expect(grid.getChildAt(1, 1)).toBe(label);
    });

    it("moves a child when its cell changes", async () => {
        const gridRef = createRef<Gtk.Grid>();

        function App({ column }: { column: number }) {
            return (
                <Grid ref={gridRef}>
                    <Grid.Child column={column} row={0}>
                        {(ref) => <GtkLabel ref={ref} label="movable" />}
                    </Grid.Child>
                </Grid>
            );
        }

        const { rerender } = await render(<App column={0} />);
        const label = gridRef.current?.getChildAt(0, 0);
        expect(label).not.toBeNull();

        await rerender(<App column={2} />);
        expect(gridRef.current?.getChildAt(0, 0)).toBeNull();
        expect(gridRef.current?.getChildAt(2, 0)).toBe(label);
    });

    it("removes a child when it unmounts", async () => {
        const gridRef = createRef<Gtk.Grid>();

        function App({ show }: { show: boolean }) {
            return (
                <Grid ref={gridRef}>
                    {show && (
                        <Grid.Child column={0} row={0}>
                            {(ref) => <GtkLabel ref={ref} label="A" />}
                        </Grid.Child>
                    )}
                </Grid>
            );
        }

        const { rerender } = await render(<App show={true} />);
        expect(gridRef.current?.getChildAt(0, 0)).not.toBeNull();

        await rerender(<App show={false} />);
        expect(gridRef.current?.getChildAt(0, 0)).toBeNull();
    });
});
