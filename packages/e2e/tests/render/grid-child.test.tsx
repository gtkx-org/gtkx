import type * as Gtk from "@gtkx/ffi/gtk";
import { GridChild, GtkGrid, GtkLabel } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - GridChild", () => {
    describe("GridChildNode", () => {
        it("positions child at specified row/column", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkGrid ref={gridRef}>
                    <GridChild column={1} row={2}>
                        <GtkLabel ref={labelRef} label="Cell" />
                    </GridChild>
                </GtkGrid>,
                { wrapper: false },
            );

            const childAt = gridRef.current?.getChildAt(1, 2);
            expect(childAt?.equals(labelRef.current)).toBe(true);
        });

        it("positions child at default (0,0) when no position specified", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkGrid ref={gridRef}>
                    <GridChild>
                        <GtkLabel ref={labelRef} label="Default" />
                    </GridChild>
                </GtkGrid>,
                { wrapper: false },
            );

            const childAt = gridRef.current?.getChildAt(0, 0);
            expect(childAt?.equals(labelRef.current)).toBe(true);
        });

        it("sets column span", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkGrid ref={gridRef}>
                    <GridChild column={0} row={0} columnSpan={3}>
                        <GtkLabel ref={labelRef} label="Wide" />
                    </GridChild>
                </GtkGrid>,
                { wrapper: false },
            );

            expect(gridRef.current?.getChildAt(0, 0)?.equals(labelRef.current)).toBe(true);
            expect(gridRef.current?.getChildAt(1, 0)?.equals(labelRef.current)).toBe(true);
            expect(gridRef.current?.getChildAt(2, 0)?.equals(labelRef.current)).toBe(true);
        });

        it("sets row span", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkGrid ref={gridRef}>
                    <GridChild column={0} row={0} rowSpan={2}>
                        <GtkLabel ref={labelRef} label="Tall" />
                    </GridChild>
                </GtkGrid>,
                { wrapper: false },
            );

            expect(gridRef.current?.getChildAt(0, 0)?.equals(labelRef.current)).toBe(true);
            expect(gridRef.current?.getChildAt(0, 1)?.equals(labelRef.current)).toBe(true);
        });

        it("updates position on prop change", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const labelRef = createRef<Gtk.Label>();

            function App({ col, row }: { col: number; row: number }) {
                return (
                    <GtkGrid ref={gridRef}>
                        <GridChild column={col} row={row}>
                            <GtkLabel ref={labelRef} label="Moving" />
                        </GridChild>
                    </GtkGrid>
                );
            }

            await render(<App col={0} row={0} />, { wrapper: false });
            expect(gridRef.current?.getChildAt(0, 0)?.equals(labelRef.current)).toBe(true);

            await render(<App col={2} row={1} />, { wrapper: false });
            expect(gridRef.current?.getChildAt(2, 1)?.equals(labelRef.current)).toBe(true);
        });

        it("places multiple children in grid", async () => {
            const gridRef = createRef<Gtk.Grid>();
            const label1Ref = createRef<Gtk.Label>();
            const label2Ref = createRef<Gtk.Label>();

            await render(
                <GtkGrid ref={gridRef}>
                    <GridChild column={0} row={0}>
                        <GtkLabel ref={label1Ref} label="Top Left" />
                    </GridChild>
                    <GridChild column={1} row={1}>
                        <GtkLabel ref={label2Ref} label="Bottom Right" />
                    </GridChild>
                </GtkGrid>,
                { wrapper: false },
            );

            expect(gridRef.current?.getChildAt(0, 0)?.equals(label1Ref.current)).toBe(true);
            expect(gridRef.current?.getChildAt(1, 1)?.equals(label2Ref.current)).toBe(true);
        });

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
            expect(gridRef.current?.getChildAt(0, 0)).not.toBeNull();

            await render(<App showChild={false} />, { wrapper: false });
            expect(gridRef.current?.getChildAt(0, 0)).toBeNull();
        });
    });
});
