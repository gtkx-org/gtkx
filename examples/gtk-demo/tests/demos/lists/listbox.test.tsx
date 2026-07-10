import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listboxDemo } from "../../../src/demos/lists/listbox.js";
import { renderDemo } from "../../test-utils.js";

vi.setConfig({ testTimeout: 60000 });

const findListBox = async (): Promise<Gtk.ListBox> => (await screen.findByName("list-box")) as Gtk.ListBox;

const findRow = async (index: number): Promise<Gtk.ListBoxRow> => {
    const listBox = await findListBox();
    return within(listBox).getAllByRole(Gtk.AccessibleRole.LIST_ITEM)[index] as Gtk.ListBoxRow;
};

const findFirstRow = (): Promise<Gtk.ListBoxRow> => findRow(0);

const revealActionButtons = async (row: Gtk.ListBoxRow): Promise<void> => {
    row.setStateFlags(Gtk.StateFlags.PRELIGHT, false);
    await fireEvent(row, "state-flags-changed", Gtk.StateFlags.NORMAL);
};

describe("listboxDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listboxDemo.id).toBe("listbox");
        expect(listboxDemo.title).toBe("List Box/Complex");
        expect(listboxDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listboxDemo.keywords)).toBe(true);
        expect(typeof listboxDemo.sourceCode).toBe("string");
        expect(listboxDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(listboxDemo.defaultWidth).toBe(400);
        expect(listboxDemo.defaultHeight).toBe(600);
        expect(listboxDemo.component).toBeTypeOf("function");
    });
});

describe("listboxDemo rendering", () => {
    it("renders the header label inside the demo", async () => {
        await renderDemo(listboxDemo);
        expect(await screen.findByText("Messages from GTK and friends")).toHaveTextContent(
            "Messages from GTK and friends",
        );
    });

    it("wraps the list box in a scrolled window with the expected policies", async () => {
        await renderDemo(listboxDemo);
        const sw = (await screen.findByName("scrolled")) as Gtk.ScrolledWindow;
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        const [h, v] = sw.getPolicy();
        expect(h).toBe(Gtk.PolicyType.NEVER);
        expect(v).toBe(Gtk.PolicyType.AUTOMATIC);
    });

    it("renders a GtkListBox configured for double-click activation", async () => {
        await renderDemo(listboxDemo);
        const listBox = await findListBox();
        expect(listBox).toBeInstanceOf(Gtk.ListBox);
        expect(listBox.getActivateOnSingleClick()).toBe(false);
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
        const firstBox = (within(firstRow).getAllByText("Resent by")[0] as Gtk.Widget).getParent() as Gtk.Widget;
        const secondBox = (within(secondRow).getAllByText("Resent by")[0] as Gtk.Widget).getParent() as Gtk.Widget;
        expect(firstBox.getVisible()).toBe(false);
        expect(secondBox.getVisible()).toBe(true);
    });
});

describe("listboxDemo row interaction", () => {
    it("toggles the message details revealer when a row is activated", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await findFirstRow();
        const revealer = within(firstRow).getByName("details-revealer") as Gtk.Revealer;
        const before = revealer.getRevealChild();
        await userEvent.click(firstRow);
        await waitFor(() => expect(revealer.getRevealChild()).toBe(!before));
    });

    it("returns to the initial revealer state after a second activation", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await findFirstRow();
        const revealer = within(firstRow).getByName("details-revealer") as Gtk.Revealer;
        const initial = revealer.getRevealChild();
        await userEvent.click(firstRow);
        await userEvent.click(firstRow);
        await waitFor(() => expect(revealer.getRevealChild()).toBe(initial));
    });
});

describe("listboxDemo expand / hide button", () => {
    it("toggles the row revealer and the button label when the expand button is clicked", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await findFirstRow();
        const expandButton = within(firstRow).getByName("expand-button") as Gtk.Button;
        const revealer = within(firstRow).getByName("details-revealer") as Gtk.Revealer;
        expect(expandButton.getLabel()).toBe("Expand");
        const before = revealer.getRevealChild();
        await userEvent.click(expandButton);
        await waitFor(() => expect(revealer.getRevealChild()).toBe(!before));
        expect(expandButton.getLabel()).toBe("Hide");
    });
});

describe("listboxDemo row state flags", () => {
    it("reveals the per-row action button box when the row gains prelight", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await findFirstRow();
        const replyLabel = within(firstRow).getAllByText("Reply")[0] as Gtk.Widget;
        const actionBox = replyLabel.getParent()?.getParent() as Gtk.Widget;
        expect(actionBox.getVisible()).toBe(false);
        await revealActionButtons(firstRow);
        await waitFor(() => expect(actionBox.getVisible()).toBe(true));
    });
});

describe("listboxDemo favorite and reshare actions", () => {
    it("increments the favorites count shown in the details revealer when Favorite is clicked", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await findFirstRow();
        await revealActionButtons(firstRow);
        const expandButton = within(firstRow).getByName("expand-button") as Gtk.Button;
        await userEvent.click(expandButton);
        await waitFor(() => expect(within(firstRow).getByText(/Favorites/)).toHaveTextContent("2"));
        const favoriteButton = within(firstRow).getByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Favorite",
        }) as Gtk.Button;
        await userEvent.click(favoriteButton);
        await waitFor(() => expect(within(firstRow).getByText(/Favorites/)).toHaveTextContent("3"));
    });

    it("increments the reshares count shown in the details revealer when Reshare is clicked", async () => {
        await renderDemo(listboxDemo);
        const firstRow = await findFirstRow();
        await revealActionButtons(firstRow);
        const expandButton = within(firstRow).getByName("expand-button") as Gtk.Button;
        await userEvent.click(expandButton);
        await waitFor(() => expect(within(firstRow).getByText(/Reshares/)).toHaveTextContent("1"));
        const reshareButton = within(firstRow).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Reshare" }) as Gtk.Button;
        await userEvent.click(reshareButton);
        await waitFor(() => expect(within(firstRow).getByText(/Reshares/)).toHaveTextContent("2"));
    });
});
