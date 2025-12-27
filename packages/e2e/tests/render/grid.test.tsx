import type * as Gtk from "@gtkx/ffi/gtk";
import { GridChild, GtkGrid, GtkLabel } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Grid", () => {
    describe("GtkGrid", () => {
        it("creates Grid widget", async () => {
            const ref = createRef<Gtk.Grid>();

            await render(<GtkGrid ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });
    });

    describe("GridChild", () => {
        it("attaches child at column, row position", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkGrid ref={gridRef}>
                    <GridChild column={1} row={2}>
                        <GtkLabel ref={labelRef} label="Positioned" />
                    </GridChild>
                </GtkGrid>,
                { wrapper: false },
            );

            expect(labelRef.current?.getParent()?.id).toEqual(gridRef.current?.id);
        });

        it("respects columnSpan and rowSpan", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkGrid ref={gridRef}>
                    <GridChild column={0} row={0} columnSpan={2} rowSpan={3}>
                        <GtkLabel ref={labelRef} label="Spanning" />
                    </GridChild>
                </GtkGrid>,
                { wrapper: false },
            );

            expect(labelRef.current).not.toBeNull();
        });

        it("uses default values for missing props", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkGrid ref={gridRef}>
                    <GridChild>
                        <GtkLabel ref={labelRef} label="Default Position" />
                    </GridChild>
                </GtkGrid>,
                { wrapper: false },
            );

            expect(labelRef.current?.getParent()?.id).toEqual(gridRef.current?.id);
        });
    });

    describe("position updates", () => {
        it("repositions child when column/row changes", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const labelRef = createRef<Gtk.Label>();

            function App({ column, row }: { column: number; row: number }) {
                return (
                    <GtkGrid ref={gridRef}>
                        <GridChild column={column} row={row}>
                            <GtkLabel ref={labelRef} label="Moving" />
                        </GridChild>
                    </GtkGrid>
                );
            }

            await render(<App column={0} row={0} />, { wrapper: false });

            await render(<App column={2} row={3} />, { wrapper: false });

            expect(labelRef.current?.getParent()?.id).toEqual(gridRef.current?.id);
        });

        it("updates span when columnSpan/rowSpan changes", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const labelRef = createRef<Gtk.Label>();

            function App({ columnSpan, rowSpan }: { columnSpan: number; rowSpan: number }) {
                return (
                    <GtkGrid ref={gridRef}>
                        <GridChild column={0} row={0} columnSpan={columnSpan} rowSpan={rowSpan}>
                            <GtkLabel ref={labelRef} label="Resizing" />
                        </GridChild>
                    </GtkGrid>
                );
            }

            await render(<App columnSpan={1} rowSpan={1} />, { wrapper: false });

            await render(<App columnSpan={3} rowSpan={2} />, { wrapper: false });

            expect(labelRef.current).not.toBeNull();
        });
    });

    describe("removal", () => {
        it("removes child from grid", async () => {
            const gridRef = createRef<Gtk.Grid>();

            function App({ showChild }: { showChild: boolean }) {
                return (
                    <GtkGrid ref={gridRef}>
                        {showChild && (
                            <GridChild column={0} row={0}>
                                Removable
                            </GridChild>
                        )}
                    </GtkGrid>
                );
            }

            await render(<App showChild={true} />, { wrapper: false });

            expect(gridRef.current?.getFirstChild()).not.toBeNull();

            await render(<App showChild={false} />, { wrapper: false });

            expect(gridRef.current?.getFirstChild()).toBeNull();
        });
    });
});
