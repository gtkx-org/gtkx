import * as Gtk from "@gtkx/gi/gtk";
import { composeStories } from "@gtkx/storybook";
import { render, screen, userEvent } from "@gtkx/testing";
import { expect, it } from "vitest";
import * as stories from "../src/confirmation.stories.js";

const { Default } = composeStories(stories);

it("opens the native dialog and discards the draft", async () => {
    let discards = 0;
    await render(
        <Default
            onDiscard={() => {
                discards += 1;
            }}
        />,
    );

    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Discard draft" }));
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Discard" }));

    expect(await screen.findByText("Draft discarded")).toBeVisible();
    expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Keep draft" })).toBeNull();
    expect(discards).toBe(1);
});
