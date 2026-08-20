import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { transitionsDemo } from "../src/demos/transitions.js";

const ANIMATED = { areAnimationsEnabled: true };
const TransitionsDemo = transitionsDemo.component;

const findButton = (name: string): Promise<Gtk.Button> =>
    screen.findByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.Button });

const expectSettledIn = (label: Gtk.Label): Promise<void> =>
    waitFor(() => {
        expect(label.getOpacity()).toBeCloseTo(1, 2);
        expect(label).toHaveObjectProperty("marginStart", 0);
    });

describe("transitions demo", () => {
    it("fades the initial items in and animates an added item to rest", async () => {
        await render(<TransitionsDemo />, ANIMATED);
        await expectSettledIn(screen.getByText("Item 1", { as: Gtk.Label }));
        await expectSettledIn(screen.getByText("Item 2", { as: Gtk.Label }));
        await userEvent.click(await findButton("Add"));
        await expectSettledIn(await screen.findByText("Item 3", { as: Gtk.Label }));
    });

    it("keeps a removed item while it fades out, then drops it", async () => {
        await render(<TransitionsDemo />, ANIMATED);
        const second = screen.getByText("Item 2", { as: Gtk.Label });
        await expectSettledIn(second);
        await userEvent.click(await findButton("Remove"));
        expect(screen.getByText("Item 2")).toBe(second);

        await waitFor(() => {
            expect(screen.queryByText("Item 2")).toBeNull();
        });

        await expectSettledIn(screen.getByText("Item 1", { as: Gtk.Label }));
    });

    it("drops an item removed while it is still entering", async () => {
        await render(<TransitionsDemo />, ANIMATED);
        await userEvent.click(await findButton("Add"));
        await userEvent.click(await findButton("Remove"));

        await waitFor(() => {
            expect(screen.queryByText("Item 3")).toBeNull();
        });

        await expectSettledIn(screen.getByText("Item 1", { as: Gtk.Label }));
        await expectSettledIn(screen.getByText("Item 2", { as: Gtk.Label }));
    });

    it("empties the list, disables Remove, and adds a fresh item afterwards", async () => {
        await render(<TransitionsDemo />, ANIMATED);
        const remove = await findButton("Remove");
        await userEvent.click(remove);
        await userEvent.click(remove);

        await waitFor(() => {
            expect(screen.queryByText("Item 1")).toBeNull();
            expect(screen.queryByText("Item 2")).toBeNull();
        });

        await waitFor(() => {
            expect(remove).toHaveObjectProperty("sensitive", false);
        });

        await userEvent.click(await findButton("Add"));
        await expectSettledIn(await screen.findByText("Item 3", { as: Gtk.Label }));

        await waitFor(() => {
            expect(remove).toHaveObjectProperty("sensitive", true);
        });
    });
});
