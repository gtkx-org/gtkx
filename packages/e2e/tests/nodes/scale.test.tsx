import * as Gtk from "@gtkx/ffi/gtk";
import { GtkScale } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const expectDefaultRange = (scale: Gtk.Scale | null): void => {
    expect(scale).toBeInstanceOf(Gtk.Scale);
    const adjustment = scale?.getAdjustment();
    expect(adjustment?.getLower()).toBe(0);
    expect(adjustment?.getUpper()).toBe(100);
    expect(adjustment?.getValue()).toBe(0);
};

const MIN_MAX_MARKS = [
    { value: 0, label: "Min" },
    { value: 100, label: "Max" },
];

const MIN_MID_MAX_MARKS = [
    { value: 0, label: "Min" },
    { value: 50, label: "Mid" },
    { value: 100, label: "Max" },
];

describe("render - Scale > ScaleNode (1)", () => {
    it("creates Scale widget without marks", async () => {
        const ref = createRef<Gtk.Scale>();

        await render(<GtkScale ref={ref} />);

        expectDefaultRange(ref.current);
    });

    it("creates Scale widget with marks", async () => {
        const ref = createRef<Gtk.Scale>();

        await render(
            <GtkScale
                ref={ref}
                marks={[
                    { value: 0, label: "Min" },
                    { value: 50, label: "Mid" },
                    { value: 100, label: "Max" },
                ]}
            />,
        );

        expectDefaultRange(ref.current);
    });

    it("sets mark position", async () => {
        const ref = createRef<Gtk.Scale>();

        await render(
            <GtkScale
                ref={ref}
                marks={[
                    { value: 0, position: Gtk.PositionType.TOP, label: "Top" },
                    { value: 100, position: Gtk.PositionType.BOTTOM, label: "Bottom" },
                ]}
            />,
        );

        expectDefaultRange(ref.current);
    });
});

describe("render - Scale > ScaleNode (2)", () => {
    it("sets marks without labels", async () => {
        const ref = createRef<Gtk.Scale>();

        await render(
            <GtkScale ref={ref} marks={[{ value: 0 }, { value: 25 }, { value: 50 }, { value: 75 }, { value: 100 }]} />,
        );

        expectDefaultRange(ref.current);
    });

    it("updates marks when props change", async () => {
        const ref = createRef<Gtk.Scale>();

        function App({ label }: { label: string }) {
            return (
                <GtkScale
                    ref={ref}
                    marks={[
                        { value: 0, label },
                        { value: 100, label: "End" },
                    ]}
                />
            );
        }

        await render(<App label="Start" />);
        expectDefaultRange(ref.current);

        await render(<App label="Begin" />);
        expectDefaultRange(ref.current);
    });
});

describe("render - Scale > ScaleNode (3)", () => {
    it("removes marks when array changes", async () => {
        const ref = createRef<Gtk.Scale>();

        function App({ showExtra }: { showExtra: boolean }) {
            return <GtkScale ref={ref} marks={showExtra ? MIN_MID_MAX_MARKS : MIN_MAX_MARKS} />;
        }

        await render(<App showExtra={true} />);
        expectDefaultRange(ref.current);

        await render(<App showExtra={false} />);
        expectDefaultRange(ref.current);
    });

    it("handles inserting marks in the middle", async () => {
        const ref = createRef<Gtk.Scale>();

        function App({ showMid }: { showMid: boolean }) {
            return <GtkScale ref={ref} marks={showMid ? MIN_MID_MAX_MARKS : MIN_MAX_MARKS} />;
        }

        await render(<App showMid={false} />);
        expectDefaultRange(ref.current);

        await render(<App showMid={true} />);
        expectDefaultRange(ref.current);
    });
});
