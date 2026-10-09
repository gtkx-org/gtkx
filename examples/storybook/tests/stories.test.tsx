import * as Gtk from "@gtkx/gi/gtk";
import { composeStories } from "@gtkx/storybook";
import { render, screen, userEvent } from "@gtkx/testing";
import { expect, it } from "vitest";
import preview from "../.storybook/preview.js";
import * as stories from "../src/counter-card.stories.js";

const { Default } = composeStories(stories, preview);

it("reuses preview decorators and overrides story arguments", async () => {
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
});
