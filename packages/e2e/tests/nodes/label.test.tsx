import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { act, render } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";

describe("render - Label text children (1)", () => {
    it("sets the label property from a single text child", async () => {
        const ref = createRef<Gtk.Label>();

        await render(<GtkLabel ref={ref}>Hello</GtkLabel>);

        expect(ref.current?.getLabel()).toBe("Hello");
    });

    it("concatenates interpolated segments in order", async () => {
        const ref = createRef<Gtk.Label>();

        function App({ count }: { count: number }) {
            return <GtkLabel ref={ref}>Count: {count}</GtkLabel>;
        }

        const { rerender } = await render(<App count={1} />);

        expect(ref.current?.getLabel()).toBe("Count: 1");

        await rerender(<App count={2} />);

        expect(ref.current?.getLabel()).toBe("Count: 2");
    });

    it("keeps order when a middle segment toggles", async () => {
        const ref = createRef<Gtk.Label>();

        function App({ showMiddle }: { showMiddle: boolean }) {
            return <GtkLabel ref={ref}>Start{showMiddle && " Middle"} End</GtkLabel>;
        }

        const { rerender } = await render(<App showMiddle={false} />);

        expect(ref.current?.getLabel()).toBe("Start End");

        await rerender(<App showMiddle={true} />);

        expect(ref.current?.getLabel()).toBe("Start Middle End");

        await rerender(<App showMiddle={false} />);

        expect(ref.current?.getLabel()).toBe("Start End");
    });
});

describe("render - Label text children (2)", () => {
    it("clears the label when the last text child is removed", async () => {
        const ref = createRef<Gtk.Label>();

        function App({ showText }: { showText: boolean }) {
            return <GtkLabel ref={ref}>{showText && "Gone soon"}</GtkLabel>;
        }

        const { rerender } = await render(<App showText={true} />);

        expect(ref.current?.getLabel()).toBe("Gone soon");

        await rerender(<App showText={false} />);

        expect(ref.current?.getLabel()).toBe("");
    });

    it("keeps the label prop when text children are replaced by it", async () => {
        const ref = createRef<Gtk.Label>();

        function App({ useProp }: { useProp: boolean }) {
            return useProp ? <GtkLabel ref={ref} label="From prop" /> : <GtkLabel ref={ref}>From children</GtkLabel>;
        }

        const { rerender } = await render(<App useProp={false} />);

        expect(ref.current?.getLabel()).toBe("From children");

        await rerender(<App useProp={true} />);

        expect(ref.current?.getLabel()).toBe("From prop");
    });

    it("updates through state-driven rerenders", async () => {
        const ref = createRef<Gtk.Label>();
        let increment = () => {};

        function App() {
            const [count, setCount] = useState(0);
            increment = () => setCount((value) => value + 1);
            return <GtkLabel ref={ref}>Clicked {count} times</GtkLabel>;
        }

        await render(<App />);

        expect(ref.current?.getLabel()).toBe("Clicked 0 times");

        await act(() => increment());

        expect(ref.current?.getLabel()).toBe("Clicked 1 times");
    });

    it("throws when a label mixes a label prop with text children", async () => {
        await expect(render(<GtkLabel label="prop">children</GtkLabel>)).rejects.toThrow(
            /cannot mix a `label` prop with text children/,
        );
    });
});
