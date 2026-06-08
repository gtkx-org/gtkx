import type * as Gtk from "@gtkx/gi/gtk";
import { GtkGrid, GtkGridChild, GtkLabel } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - GridChild > GridChildNode (1)", () => {
    it("positions child at specified row/column", async () => {
        const gridRef = createRef<Gtk.Grid>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkGrid ref={gridRef}>
                <GtkGridChild column={1} row={2}>
                    <GtkLabel ref={labelRef} label="Cell" />
                </GtkGridChild>
            </GtkGrid>,
        );

        const childAt = gridRef.current?.getChildAt(1, 2);
        expect(childAt && labelRef.current && childAt === labelRef.current).toBe(true);
    });

    it("positions child at default (0,0) when no position specified", async () => {
        const gridRef = createRef<Gtk.Grid>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkGrid ref={gridRef}>
                <GtkGridChild>
                    <GtkLabel ref={labelRef} label="Default" />
                </GtkGridChild>
            </GtkGrid>,
        );

        const childAt = gridRef.current?.getChildAt(0, 0);
        expect(childAt && labelRef.current && childAt === labelRef.current).toBe(true);
    });
});

describe("render - GridChild > GridChildNode (2)", () => {
    it("sets column span", async () => {
        const gridRef = createRef<Gtk.Grid>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkGrid ref={gridRef}>
                <GtkGridChild column={0} row={0} columnSpan={3}>
                    <GtkLabel ref={labelRef} label="Wide" />
                </GtkGridChild>
            </GtkGrid>,
        );

        const child00 = gridRef.current?.getChildAt(0, 0);
        const child10 = gridRef.current?.getChildAt(1, 0);
        const child20 = gridRef.current?.getChildAt(2, 0);
        expect(child00 && labelRef.current && child00 === labelRef.current).toBe(true);
        expect(child10 && labelRef.current && child10 === labelRef.current).toBe(true);
        expect(child20 && labelRef.current && child20 === labelRef.current).toBe(true);
    });

    it("sets row span", async () => {
        const gridRef = createRef<Gtk.Grid>();
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkGrid ref={gridRef}>
                <GtkGridChild column={0} row={0} rowSpan={2}>
                    <GtkLabel ref={labelRef} label="Tall" />
                </GtkGridChild>
            </GtkGrid>,
        );

        const child00 = gridRef.current?.getChildAt(0, 0);
        const child01 = gridRef.current?.getChildAt(0, 1);
        expect(child00 && labelRef.current && child00 === labelRef.current).toBe(true);
        expect(child01 && labelRef.current && child01 === labelRef.current).toBe(true);
    });
});

describe("render - GridChild > GridChildNode (3)", () => {
    it("updates position on prop change", async () => {
        const gridRef = createRef<Gtk.Grid>();
        const labelRef = createRef<Gtk.Label>();

        function App({ col, row }: { col: number; row: number }) {
            return (
                <GtkGrid ref={gridRef}>
                    <GtkGridChild column={col} row={row}>
                        <GtkLabel ref={labelRef} label="Moving" />
                    </GtkGridChild>
                </GtkGrid>
            );
        }

        await render(<App col={0} row={0} />);
        const child00 = gridRef.current?.getChildAt(0, 0);
        expect(child00 && labelRef.current && child00 === labelRef.current).toBe(true);

        await render(<App col={2} row={1} />);
        const child21 = gridRef.current?.getChildAt(2, 1);
        expect(child21 && labelRef.current && child21 === labelRef.current).toBe(true);
    });

    it("places multiple children in grid", async () => {
        const gridRef = createRef<Gtk.Grid>();
        const label1Ref = createRef<Gtk.Label>();
        const label2Ref = createRef<Gtk.Label>();

        await render(
            <GtkGrid ref={gridRef}>
                <GtkGridChild column={0} row={0}>
                    <GtkLabel ref={label1Ref} label="Top Left" />
                </GtkGridChild>
                <GtkGridChild column={1} row={1}>
                    <GtkLabel ref={label2Ref} label="Bottom Right" />
                </GtkGridChild>
            </GtkGrid>,
        );

        const child00 = gridRef.current?.getChildAt(0, 0);
        const child11 = gridRef.current?.getChildAt(1, 1);
        expect(child00 && label1Ref.current && child00 === label1Ref.current).toBe(true);
        expect(child11 && label2Ref.current && child11 === label2Ref.current).toBe(true);
    });
});

describe("render - GridChild > GridChildNode (4)", () => {
    it("removes child from grid", async () => {
        const gridRef = createRef<Gtk.Grid>();
        const labelRef = createRef<Gtk.Label>();

        function App({ showChild }: { showChild: boolean }) {
            return (
                <GtkGrid ref={gridRef}>
                    {showChild && (
                        <GtkGridChild column={0} row={0}>
                            <GtkLabel ref={labelRef} label="Removable" />
                        </GtkGridChild>
                    )}
                </GtkGrid>
            );
        }

        await render(<App showChild={true} />);
        expect(gridRef.current?.getChildAt(0, 0)).not.toBeNull();

        await render(<App showChild={false} />);
        expect(gridRef.current?.getChildAt(0, 0)).toBeNull();
    });
});
