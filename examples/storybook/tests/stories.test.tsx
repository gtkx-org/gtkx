import * as Gtk from "@gtkx/gi/gtk";
import { composeStories } from "@gtkx/storybook";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import preview from "../.storybook/preview.js";
import * as stories from "../src/counter-card.stories.js";

const { Default, ByFive, Disabled, InvalidStep } = composeStories(stories, preview);

describe("Counter card stories", () => {
    it("records progress and applies new arguments without losing component state", async () => {
        const increments: number[] = [];
        const onIncrement = (count: number): void => {
            increments.push(count);
        };
        const result = await render(<Default onIncrement={onIncrement} />);

        expect(screen.getByText("GTKX component gallery")).toBeVisible();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Add progress" }));
        expect(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "1 task" })).toBeVisible();

        await result.rerender(<Default step={5} unit="pages" onIncrement={onIncrement} />);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Add progress" }));
        expect(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "6 pages" })).toBeVisible();
        expect(increments).toEqual([1, 6]);

        await result.unmount();
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON)).toBeNull();
    });

    it("renders a named story with its own defaults", async () => {
        await render(<ByFive />);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Read five pages" }));
        expect(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "5 pages" })).toBeVisible();
    });

    it("prevents progress when the counter is disabled", async () => {
        await render(<Disabled />);
        const button = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Add progress" });

        expect(button).toBeDisabled();
        await expect(userEvent.click(button)).rejects.toThrow();
        expect(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "0 tasks" })).toBeVisible();
    });

    it("rejects an invalid step through the native renderer", async () => {
        await expect(render(<InvalidStep />)).rejects.toThrow();
    });
});
