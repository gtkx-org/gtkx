import { GtkLabel } from "@gtkx/jsx/gtk";
import { act, render, screen } from "@gtkx/testing";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

const noop: () => void = vi.fn();

function CountLabel({ count }: { count: number }) {
    return (
        <GtkLabel>
            Count:
            {" "}
            {count}
        </GtkLabel>
    );
}

function MiddleSegmentLabel({ showMiddle }: { showMiddle: boolean }) {
    return (
        <GtkLabel>
            Start
            {showMiddle && " Middle"}
            {" "}
            End
        </GtkLabel>
    );
}

function OptionalTextLabel({ showText }: { showText: boolean }) {
    return <GtkLabel>{showText && "Gone soon"}</GtkLabel>;
}

function PropOrChildrenLabel({ useProp }: { useProp: boolean }) {
    return useProp ? <GtkLabel label="From prop" /> : <GtkLabel>From children</GtkLabel>;
}

describe("render - Label text children (1)", () => {
    it("sets the label property from a single text child", async () => {
        await render(<GtkLabel>Hello</GtkLabel>);
        expect(screen.getByText("Hello")).toBeDefined();
    });

    it("concatenates interpolated segments in order", async () => {
        const { rerender } = await render(<CountLabel count={1} />);
        expect(screen.getByText("Count: 1")).toBeDefined();
        await rerender(<CountLabel count={2} />);
        expect(screen.getByText("Count: 2")).toBeDefined();
    });

    it("keeps order when a middle segment toggles", async () => {
        const { rerender } = await render(<MiddleSegmentLabel showMiddle={false} />);
        expect(screen.getByText("Start End")).toBeDefined();
        await rerender(<MiddleSegmentLabel showMiddle={true} />);
        expect(screen.getByText("Start Middle End")).toBeDefined();
        await rerender(<MiddleSegmentLabel showMiddle={false} />);
        expect(screen.getByText("Start End")).toBeDefined();
    });
});

describe("render - Label text children (2)", () => {
    it("clears the label when the last text child is removed", async () => {
        const { rerender } = await render(<OptionalTextLabel showText={true} />);
        expect(screen.getByText("Gone soon")).toBeDefined();
        await rerender(<OptionalTextLabel showText={false} />);
        expect(screen.queryByText("Gone soon")).toBeNull();
    });

    it("keeps the label prop when text children are replaced by it", async () => {
        const { rerender } = await render(<PropOrChildrenLabel useProp={false} />);
        expect(screen.getByText("From children")).toBeDefined();
        await rerender(<PropOrChildrenLabel useProp={true} />);
        expect(screen.getByText("From prop")).toBeDefined();
    });

    it("updates through state-driven rerenders", async () => {
        let increment = noop;

        function App() {
            const [count, setCount] = useState(0);

            useEffect(() => {
                increment = () => {
                    setCount((value) => value + 1);
                };
            });

            return (
                <GtkLabel>
                    Clicked
                    {" "}
                    {count}
                    {" "}
                    times
                </GtkLabel>
            );
        }

        await render(<App />);
        expect(screen.getByText("Clicked 0 times")).toBeDefined();

        await act(() => {
            increment();
        });

        expect(screen.getByText("Clicked 1 times")).toBeDefined();
    });

    it("throws when a label mixes a label prop with text children", async () => {
        await expect(render(<GtkLabel label="prop">children</GtkLabel>)).rejects.toThrow(
            /cannot mix a `label` prop with text children/,
        );
    });
});
