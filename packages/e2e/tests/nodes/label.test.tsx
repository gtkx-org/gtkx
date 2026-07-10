import { GtkLabel } from "@gtkx/jsx/gtk";
import { act, render, screen } from "@gtkx/testing";
import { useState } from "react";
import { describe, expect, it } from "vitest";

describe("render - Label text children (1)", () => {
    it("sets the label property from a single text child", async () => {
        await render(<GtkLabel>Hello</GtkLabel>);

        expect(screen.getByText("Hello")).toBeDefined();
    });

    it("concatenates interpolated segments in order", async () => {
        function App({ count }: { count: number }) {
            return <GtkLabel>Count: {count}</GtkLabel>;
        }

        const { rerender } = await render(<App count={1} />);

        expect(screen.getByText("Count: 1")).toBeDefined();

        await rerender(<App count={2} />);

        expect(screen.getByText("Count: 2")).toBeDefined();
    });

    it("keeps order when a middle segment toggles", async () => {
        function App({ showMiddle }: { showMiddle: boolean }) {
            return <GtkLabel>Start{showMiddle && " Middle"} End</GtkLabel>;
        }

        const { rerender } = await render(<App showMiddle={false} />);

        expect(screen.getByText("Start End")).toBeDefined();

        await rerender(<App showMiddle={true} />);

        expect(screen.getByText("Start Middle End")).toBeDefined();

        await rerender(<App showMiddle={false} />);

        expect(screen.getByText("Start End")).toBeDefined();
    });
});

describe("render - Label text children (2)", () => {
    it("clears the label when the last text child is removed", async () => {
        function App({ showText }: { showText: boolean }) {
            return <GtkLabel>{showText && "Gone soon"}</GtkLabel>;
        }

        const { rerender } = await render(<App showText={true} />);

        expect(screen.getByText("Gone soon")).toBeDefined();

        await rerender(<App showText={false} />);

        expect(screen.queryByText("Gone soon")).toBeNull();
    });

    it("keeps the label prop when text children are replaced by it", async () => {
        function App({ useProp }: { useProp: boolean }) {
            return useProp ? <GtkLabel label="From prop" /> : <GtkLabel>From children</GtkLabel>;
        }

        const { rerender } = await render(<App useProp={false} />);

        expect(screen.getByText("From children")).toBeDefined();

        await rerender(<App useProp={true} />);

        expect(screen.getByText("From prop")).toBeDefined();
    });

    it("updates through state-driven rerenders", async () => {
        let increment = () => {};

        function App() {
            const [count, setCount] = useState(0);
            increment = () => setCount((value) => value + 1);
            return <GtkLabel>Clicked {count} times</GtkLabel>;
        }

        await render(<App />);

        expect(screen.getByText("Clicked 0 times")).toBeDefined();

        await act(() => increment());

        expect(screen.getByText("Clicked 1 times")).toBeDefined();
    });

    it("throws when a label mixes a label prop with text children", async () => {
        await expect(render(<GtkLabel label="prop">children</GtkLabel>)).rejects.toThrow(
            /cannot mix a `label` prop with text children/,
        );
    });
});
