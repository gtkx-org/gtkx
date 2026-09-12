import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { composeStories } from "@gtkx/storybook";
import { render, screen, userEvent } from "@gtkx/testing";
import { expect, it } from "vitest";
import preview from "../.storybook/preview.js";
import * as stories from "../src/progress-window.stories.js";

const { Default } = composeStories(stories, preview);

it("presents the progress story in its own window and closes it on unmount", async () => {
    const result = await render(<Default />, { container: rootElement });
    expect(screen.getByRole(Gtk.AccessibleRole.WINDOW, { name: "Daily Progress" })).toBeVisible();

    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Complete task" }));
    expect(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "1 task" })).toBeVisible();

    await result.unmount();
    expect(screen.queryByRole(Gtk.AccessibleRole.WINDOW, { name: "Daily Progress" })).toBeNull();
});
