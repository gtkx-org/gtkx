import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";

describe("byText", () => {
    it("returns the label rendering the text, matched exactly among siblings", async () => {
        await render(
            <GtkBox>
                <GtkLabel label="Welcome!" />
                <GtkLabel label="Count: 2" />
            </GtkBox>,
        );

        const label = await screen.findByText("Count: 2");
        expect(label).toBeInstanceOf(Gtk.Label);
        expect((label as Gtk.Label).getLabel()).toBe("Count: 2");
    });

    it("never matches a container by its children's joined text", async () => {
        await render(
            <GtkBox>
                <GtkLabel label="Welcome!" />
                <GtkLabel label="Count: 2" />
            </GtkBox>,
        );

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
        const onClicked = vi.fn();
        await render(<GtkButton label="Save" onClicked={onClicked} />);

        await userEvent.click(await screen.findByText("Save"));

        expect(onClicked).toHaveBeenCalledTimes(1);
    });

    it("clicking a button found by role and name activates it", async () => {
        const onClicked = vi.fn();
        await render(<GtkButton label="Save" onClicked={onClicked} />);

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" }));

        expect(onClicked).toHaveBeenCalledTimes(1);
    });
});
