import * as Gtk from "@gtkx/gi/gtk";
import { composeStories } from "@gtkx/storybook";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import * as stories from "../src/confirmation.stories.js";

const { Default } = composeStories(stories);

describe("Confirmation story", () => {
    it("opens the native dialog and discards the draft", async () => {
        let discards = 0;
        await render(
            <Default onDiscard={() => {
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

    it("keeps the draft when confirmation is cancelled", async () => {
        await render(<Default />);

        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Discard draft" }));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Keep draft" }));

        expect(screen.getByText("An unsaved draft is ready")).toBeVisible();
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Discard" })).toBeNull();
    });

    it("propagates a failed discard callback", async () => {
        await render(
            <Default onDiscard={() => {
                throw new Error("Unable to discard");
            }}
            />,
        );
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Discard draft" }));

        await expect(
            userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Discard" })),
        ).rejects.toThrow();
    });
});
