import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, userEvent, waitFor, within } from "@gtkx/testing";
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

const revealActionButtons = async (row: Gtk.ListBoxRow): Promise<void> => {
    row.setStateFlags(Gtk.StateFlags.PRELIGHT, false);
    await fireEvent(row, "state-flags-changed", Gtk.StateFlags.NORMAL);
};

const expandFirstRow = async (): Promise<Gtk.ListBoxRow> => {
    const firstRow = await findFirstRow();
    await revealActionButtons(firstRow);
    const expandButton = within(firstRow).getByName("expand-button", { as: Gtk.Button });
    await userEvent.click(expandButton);

    return firstRow;
};

const expectRowCount = async (row: Gtk.ListBoxRow, label: RegExp, count: string): Promise<void> => {
    await waitFor(() => {
        expect(within(row).getByText(label)).toHaveTextContent(count);
    });
};

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

    it("renders a GtkListBox configured for double-click activation", async () => {
        await renderDemo(listboxDemo);
        const listBox = await findListBox();
        expect(listBox).toHaveObjectProperty("activateOnSingleClick", false);
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
        const secondBox = (within(secondRow).getAllByText("Resent by")[0] as Gtk.Widget).getParent() as Gtk.Widget;
        expect(secondBox).toBeVisible();
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
});

describe("listboxDemo row state flags", () => {
    it("reveals the per-row action button box when the row gains prelight", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await findFirstRow();
        expect(within(firstRow).queryAllByText("Reply")).toHaveLength(0);
        await revealActionButtons(firstRow);

        await waitFor(() => {
            const replyLabel = within(firstRow).getAllByText("Reply")[0] as Gtk.Widget;
            const actionBox = replyLabel.getParent()?.getParent() as Gtk.Widget;
            expect(actionBox).toBeVisible();
        });
    });
});

describe("listboxDemo favorite and reshare actions", () => {
    it("increments the favorites count shown in the details revealer when Favorite is clicked", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await expandFirstRow();
        await expectRowCount(firstRow, /Favorites/, "2");

        const favoriteButton = within(firstRow).getByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Favorite",
            as: Gtk.Button,
        });

        await userEvent.click(favoriteButton);
        await expectRowCount(firstRow, /Favorites/, "3");
    });

    it("increments the reshares count shown in the details revealer when Reshare is clicked", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await expandFirstRow();
        await expectRowCount(firstRow, /Reshares/, "1");

        const reshareButton = within(firstRow).getByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Reshare",
            as: Gtk.Button,
        });

        await userEvent.click(reshareButton);
        await expectRowCount(firstRow, /Reshares/, "2");
    });
});
