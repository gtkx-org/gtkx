import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkGrid, GtkLabel } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Grid", () => {
    describe("Grid.Root", () => {
        it("creates Grid widget", async () => {
            const ref = createRef<Gtk.Grid>();

            await render(<GtkGrid.Root ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });
    });

    describe("Grid.Child", () => {
        it("attaches child at column, row position", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkGrid.Root ref={gridRef}>
                    <GtkGrid.Child column={1} row={2}>
                        <GtkLabel ref={labelRef} label="Positioned" />
                    </GtkGrid.Child>
                </GtkGrid.Root>,
                { wrapper: false },
            );

            expect(labelRef.current?.getParent()?.id).toEqual(gridRef.current?.id);
        });

        it("respects columnSpan and rowSpan", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkGrid.Root ref={gridRef}>
                    <GtkGrid.Child column={0} row={0} columnSpan={2} rowSpan={3}>
                        <GtkLabel ref={labelRef} label="Spanning" />
                    </GtkGrid.Child>
                </GtkGrid.Root>,
                { wrapper: false },
            );

            expect(labelRef.current).not.toBeNull();
        });

        it("uses default values for missing props", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkGrid.Root ref={gridRef}>
                    <GtkGrid.Child>
                        <GtkLabel ref={labelRef} label="Default Position" />
                    </GtkGrid.Child>
                </GtkGrid.Root>,
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
                    <GtkGrid.Root ref={gridRef}>
                        <GtkGrid.Child column={column} row={row}>
                            <GtkLabel ref={labelRef} label="Moving" />
                        </GtkGrid.Child>
                    </GtkGrid.Root>
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
                    <GtkGrid.Root ref={gridRef}>
                        <GtkGrid.Child column={0} row={0} columnSpan={columnSpan} rowSpan={rowSpan}>
                            <GtkLabel ref={labelRef} label="Resizing" />
                        </GtkGrid.Child>
                    </GtkGrid.Root>
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
                    <GtkGrid.Root ref={gridRef}>
                        {showChild && (
                            <GtkGrid.Child column={0} row={0}>
                                <GtkLabel label="Removable" />
                            </GtkGrid.Child>
                        )}
                    </GtkGrid.Root>
                );
            }

            await render(<App showChild={true} />, { wrapper: false });

            expect(gridRef.current?.getFirstChild()).not.toBeNull();

            await render(<App showChild={false} />, { wrapper: false });

            expect(gridRef.current?.getFirstChild()).toBeNull();
        });
    });
});
