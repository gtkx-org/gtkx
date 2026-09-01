import type { Mock } from "vitest";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

const noop: () => void = vi.fn();

const SIBLING_LABELS = (
    <GtkBox>
        <GtkLabel>Welcome!</GtkLabel>
        <GtkLabel>Count: 2</GtkLabel>
    </GtkBox>
);

function CountLabel({ count }: { count: number }) {
    return (
        <GtkLabel>
            Count:
            {" "}
            {count}
        </GtkLabel>
    );
}

function MiddleSegmentLabel({ shouldShowMiddle }: { shouldShowMiddle: boolean }) {
    return (
        <GtkLabel>
            Start
            {shouldShowMiddle && " Middle"}
            {" "}
            End
        </GtkLabel>
    );
}

function OptionalTextLabel({ shouldShowText }: { shouldShowText: boolean }) {
    return <GtkLabel>{shouldShowText && "Gone soon"}</GtkLabel>;
}

function PropOrChildrenLabel({ shouldUseProp }: { shouldUseProp: boolean }) {
    return shouldUseProp ? <GtkLabel label="From prop" /> : <GtkLabel>From children</GtkLabel>;
}

const renderSaveButton = async (): Promise<Mock> => {
    const onClicked = vi.fn();
    await render(<GtkButton label="Save" onClicked={onClicked} />);

    return onClicked;
};

describe("render - Label text children", () => {
    it("sets the label property from a single text child", async () => {
        await render(<GtkLabel>Hello</GtkLabel>);
        expect(screen.getByText("Hello")).toBeRooted();
    });

    it("concatenates interpolated segments in order", async () => {
        const { rerender } = await render(<CountLabel count={1} />);
        expect(screen.getByText("Count: 1")).toBeRooted();
        await rerender(<CountLabel count={2} />);
        expect(screen.getByText("Count: 2")).toBeRooted();
    });

    it("keeps order when a middle segment toggles", async () => {
        const { rerender } = await render(<MiddleSegmentLabel shouldShowMiddle={false} />);
        expect(screen.getByText("Start End")).toHaveTextContent(/^Start End$/);
        await rerender(<MiddleSegmentLabel shouldShowMiddle={true} />);
        expect(screen.getByText("Start Middle End")).toHaveTextContent(/^Start Middle End$/);
        await rerender(<MiddleSegmentLabel shouldShowMiddle={false} />);
        expect(screen.getByText("Start End")).toHaveTextContent(/^Start End$/);
    });

    it("clears the label when the last text child is removed", async () => {
        const { rerender } = await render(<OptionalTextLabel shouldShowText={true} />);
        expect(screen.getByText("Gone soon")).toBeRooted();
        await rerender(<OptionalTextLabel shouldShowText={false} />);
        expect(screen.queryByText("Gone soon")).toBeNull();
    });

    it("keeps the label prop when text children are replaced by it", async () => {
        const { rerender } = await render(<PropOrChildrenLabel shouldUseProp={false} />);
        expect(screen.getByText("From children")).toBeRooted();
        await rerender(<PropOrChildrenLabel shouldUseProp={true} />);
        expect(screen.getByText("From prop")).toBeRooted();
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
        expect(screen.getByText("Clicked 0 times")).toBeRooted();

        await act(() => {
            increment();
        });

        expect(screen.getByText("Clicked 1 times")).toBeRooted();
    });

    it("throws when a label mixes a label prop with text children", async () => {
        await expect(render(<GtkLabel label="prop">children</GtkLabel>)).rejects.toThrow();
    });
});

describe("byText", () => {
    it("returns the label rendering the text, matched exactly among siblings", async () => {
        await render(SIBLING_LABELS);
        const label = await screen.findByText("Count: 2", { as: Gtk.Label });
        expect(label).toHaveTextContent(/^Count: 2$/);
        expect(label).toAppearAfter(screen.getByText("Welcome!"));
    });

    it("never matches a container by its children's joined text", async () => {
        await render(SIBLING_LABELS);
        expect(screen.queryByText("Welcome! Count: 2")).toBeNull();
    });

    it("matches a button's text through its internal label", async () => {
        await render(<GtkButton label="Increment" />);
        const label = await screen.findByText("Increment");
        expect(label).toBeInstanceOf(Gtk.Label);
        expect(label).not.toBeInstanceOf(Gtk.Button);
    });
});

describe("userEvent.click upward resolution", () => {
    it("clicking a button's internal label activates the button", async () => {
        const onClicked = await renderSaveButton();
        await userEvent.click(await screen.findByText("Save"));
        expect(onClicked).toHaveBeenCalledTimes(1);
    });

    it("clicking a button found by role and name activates it", async () => {
        const onClicked = await renderSaveButton();
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" }));
        expect(onClicked).toHaveBeenCalledTimes(1);
    });
});
