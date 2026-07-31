import * as Gtk from "@gtkx/gi/gtk";
import { GtkDrawingArea } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

const noopDraw = vi.fn<Gtk.DrawingAreaDrawFunc>();
const drawFunc1 = vi.fn<Gtk.DrawingAreaDrawFunc>();
const drawFunc2 = vi.fn<Gtk.DrawingAreaDrawFunc>();

const expectDefaultContentSize = async (drawFunc: Gtk.DrawingAreaDrawFunc | undefined) => {
    const ref = createRef<Gtk.DrawingArea>();
    await render(<GtkDrawingArea ref={ref} drawFunc={drawFunc} />);
    expect(ref.current).toBeInstanceOf(Gtk.DrawingArea);
    expect(ref.current).toHaveObjectProperty("contentWidth", 0);
    expect(ref.current).toHaveObjectProperty("contentHeight", 0);
};

describe("render - DrawingArea (1)", () => {
    it("creates DrawingArea widget", async () => {
        const ref = createRef<Gtk.DrawingArea>();
        await render(<GtkDrawingArea ref={ref} />);
        expect(ref.current).not.toBeNull();
        expect(ref.current).toBeInstanceOf(Gtk.DrawingArea);
    });

    it("creates DrawingArea without a draw function", async () => {
        await expectDefaultContentSize(undefined);
    });

    it("creates DrawingArea with a draw function", async () => {
        await expectDefaultContentSize(noopDraw);
    });

    it("sets content size", async () => {
        const ref = createRef<Gtk.DrawingArea>();
        await render(<GtkDrawingArea ref={ref} contentWidth={200} contentHeight={100} />);
        expect(ref.current).toHaveObjectProperty("contentWidth", 200);
        expect(ref.current).toHaveObjectProperty("contentHeight", 100);
    });
});

describe("render - DrawingArea (2)", () => {
    it("updates content size when props change", async () => {
        const ref = createRef<Gtk.DrawingArea>();

        function App({ width, height }: { width: number; height: number }) {
            return <GtkDrawingArea ref={ref} contentWidth={width} contentHeight={height} />;
        }

        await render(<App width={100} height={50} />);
        expect(ref.current).toHaveObjectProperty("contentWidth", 100);
        expect(ref.current).toHaveObjectProperty("contentHeight", 50);
        await render(<App width={200} height={100} />);
        expect(ref.current).toHaveObjectProperty("contentWidth", 200);
        expect(ref.current).toHaveObjectProperty("contentHeight", 100);
    });

    it("updates draw function when prop changes", async () => {
        const ref = createRef<Gtk.DrawingArea>();

        function App({ drawFunc }: { drawFunc: Gtk.DrawingAreaDrawFunc }) {
            return <GtkDrawingArea ref={ref} drawFunc={drawFunc} />;
        }

        await render(<App drawFunc={drawFunc1} />);
        expect(ref.current).toBeInstanceOf(Gtk.DrawingArea);
        expect(ref.current).toHaveObjectProperty("contentWidth", 0);
        await render(<App drawFunc={drawFunc2} />);
        expect(ref.current).toBeInstanceOf(Gtk.DrawingArea);
        expect(ref.current).toHaveObjectProperty("contentWidth", 0);
    });
});

describe("render - DrawingArea (3)", () => {
    it("sets widget properties alongside drawFunc", async () => {
        const ref = createRef<Gtk.DrawingArea>();

        await render(
            <GtkDrawingArea
                ref={ref}
                drawFunc={noopDraw}
                contentWidth={300}
                contentHeight={200}
                visible={true}
                sensitive={true}
            />,
        );

        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("contentWidth", 300);
        expect(ref.current).toHaveObjectProperty("contentHeight", 200);
        expect(ref.current).toBeVisible();
        expect(ref.current).toBeEnabled();
    });
});
