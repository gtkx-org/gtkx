import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listboxDemo } from "../../../src/demos/lists/listbox.js";
import { renderDemo } from "../../test-utils.js";

const findListBox = (): Promise<Gtk.ListBox> => screen.findByName("list-box", { as: Gtk.ListBox });

const findRow = async (index: number): Promise<Gtk.ListBoxRow> => {
    const listBox = await findListBox();

    return within(listBox).getAllByRole(Gtk.AccessibleRole.LIST_ITEM)[index] as Gtk.ListBoxRow;
};

const findFirstRow = (): Promise<Gtk.ListBoxRow> => findRow(0);

const findDetailsRevealer = (row: Gtk.ListBoxRow): Gtk.Revealer =>
    within(row).getByName("details-revealer", { as: Gtk.Revealer });

vi.setConfig({ testTimeout: 60_000 });

describe("listboxDemo rendering", () => {
    it("renders the header label inside the demo", async () => {
        await renderDemo(listboxDemo);

        expect(await screen.findByText("Messages from GTK and friends")).toHaveTextContent(
            "Messages from GTK and friends",
        );
    });

    it("wraps the list box in a scrolled window with the expected policies", async () => {
        await renderDemo(listboxDemo);
        const sw = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        const [h, v] = sw.getPolicy();
        expect(h).toBe(Gtk.PolicyType.NEVER);
        expect(v).toBe(Gtk.PolicyType.AUTOMATIC);
    });

    it("orders rows by time descending so the newest message is first", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await findFirstRow();

        expect(firstRow).toHaveTextContent(
            "@breizhodrome yeah, that's for the OpenGL support that has been added recently",
        );
    });
});

describe("listboxDemo resent-by rows", () => {
    it("hides the resent-by box for a message without a resender and shows it for one with a resender", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await findFirstRow();
        const secondRow = await findRow(1);
        expect(within(firstRow).queryAllByText("Resent by")).toHaveLength(0);
        expect(within(secondRow).getByText("Resent by")).toBeVisible();
    });
});

describe("listboxDemo row interaction", () => {
    it("toggles the message details revealer when a row is activated", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await findFirstRow();
        const revealer = findDetailsRevealer(firstRow);
        const isBefore = revealer.getRevealChild();
        await userEvent.dblClick(firstRow);

        await waitFor(() => {
            expect(revealer).toHaveObjectProperty("revealChild", !isBefore);
        });
    });

    it("returns to the initial revealer state after a second activation", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await findFirstRow();
        const revealer = findDetailsRevealer(firstRow);
        const isInitial = revealer.getRevealChild();
        await userEvent.dblClick(firstRow);
        await userEvent.dblClick(firstRow);

        await waitFor(() => {
            expect(revealer).toHaveObjectProperty("revealChild", isInitial);
        });
    });
});

describe("listboxDemo expand / hide button", () => {
    it("toggles the row revealer and the button label when the expand button is clicked", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await findFirstRow();
        const expandButton = within(firstRow).getByName("expand-button", { as: Gtk.Button });
        const revealer = findDetailsRevealer(firstRow);
        expect(expandButton).toHaveObjectProperty("label", "Expand");
        const isBefore = revealer.getRevealChild();
        await userEvent.click(expandButton);

        await waitFor(() => {
            expect(revealer).toHaveObjectProperty("revealChild", !isBefore);
        });

        expect(expandButton).toHaveObjectProperty("label", "Hide");
    });

    it("updates the visible favorite and reshare totals", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await findFirstRow();
        await userEvent.click(within(firstRow).getByName("expand-button", { as: Gtk.Button }));
        await userEvent.click(await within(firstRow).findByRole(Gtk.AccessibleRole.BUTTON, { name: "Favorite" }));
        await userEvent.click(await within(firstRow).findByRole(Gtk.AccessibleRole.BUTTON, { name: "Reshare" }));

        await waitFor(() => {
            expect(within(firstRow).getByText(/3\s+Favorites/)).toBeVisible();
            expect(within(firstRow).getByText(/2\s+Reshares/)).toBeVisible();
        });
    });
});
