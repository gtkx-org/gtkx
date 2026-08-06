import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listviewSelectionsDemo } from "../../../src/demos/lists/listview-selections.js";
import { renderDemo } from "../../test-utils.js";

async function expectListedTwiceAfterOpening(dropdown: Gtk.DropDown, text: string): Promise<void> {
    await userEvent.click(dropdown);

    await waitFor(() => {
        expect(within(dropdown).getAllByText(text)).toHaveLength(2);
    });
}

async function findVerticalColumnSeparator() {
    const sep = await screen.findByName("column-separator", { as: Gtk.Separator });
    expect(sep).toBeInstanceOf(Gtk.Separator);
    expect(sep).toHaveObjectProperty("orientation", Gtk.Orientation.VERTICAL);

    return sep;
}

function rowLabelText(row: Gtk.Widget): string {
    const label = within(row).getAllByText(/.+/)[0] as Gtk.Label;

    return label.getText();
}

async function renderWordsEntry(): Promise<Gtk.Entry> {
    await renderDemo(listviewSelectionsDemo);

    return await screen.findByName("words-entry", { as: Gtk.Entry });
}

async function findFontSpin(): Promise<Gtk.SpinButton> {
    return await screen.findByName("font-spin", { as: Gtk.SpinButton });
}

async function findFontsDropDown(): Promise<Gtk.DropDown> {
    return await screen.findByName("fonts-dropdown", { as: Gtk.DropDown });
}

async function renderDirectoryEntry(): Promise<Gtk.Entry> {
    await renderDemo(listviewSelectionsDemo);

    return await screen.findByName("directory-entry", { as: Gtk.Entry });
}

async function findDropDowns() {
    const fonts = await screen.findByName("fonts-dropdown", { as: Gtk.DropDown });
    const combos = screen.getAllByRole(Gtk.AccessibleRole.COMBO_BOX, { as: Gtk.DropDown });
    const [times, timesSectioned, fontsByOrder, devices] = combos;
    expect(fontsByOrder).toBe(fonts);

    return {
        times: times as Gtk.DropDown,
        timesSectioned: timesSectioned as Gtk.DropDown,
        fonts,
        devices: devices as Gtk.DropDown,
    };
}

describe("listviewSelectionsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewSelectionsDemo.id).toBe("listview-selections");
        expect(listviewSelectionsDemo.title).toBe("Lists/Selections");
        expect(listviewSelectionsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewSelectionsDemo.keywords)).toBe(true);
        expect(typeof listviewSelectionsDemo.sourceCode).toBe("string");
        expect(listviewSelectionsDemo.component).toBeTypeOf("function");
    });
});

describe("listviewSelectionsDemo layout", () => {
    it("renders Dropdowns and Suggestions section titles", async () => {
        await renderDemo(listviewSelectionsDemo);
        expect(await screen.findByText("Dropdowns")).toHaveTextContent("Dropdowns");
        expect(await screen.findByText("Suggestions")).toHaveTextContent("Suggestions");
    });

    it("renders the fonts dropdown with search disabled and a column separator", async () => {
        await renderDemo(listviewSelectionsDemo);
        const fonts = await findFontsDropDown();
        expect(fonts).toHaveObjectProperty("enableSearch", false);
        await findVerticalColumnSeparator();
    });

    it("renders a vertical separator between the two columns", async () => {
        await renderDemo(listviewSelectionsDemo);
        const separator = await findVerticalColumnSeparator();
        expect(separator).toHaveObjectProperty("orientation", Gtk.Orientation.VERTICAL);
    });
});

describe("listviewSelectionsDemo controls", () => {
    it("renders the Enable Search check button initially inactive", async () => {
        await renderDemo(listviewSelectionsDemo);
        const check = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Enable search", checked: false });
        expect(check).not.toBeChecked();
    });

    it("renders a GtkSpinButton synced with the font index", async () => {
        await renderDemo(listviewSelectionsDemo);
        expect(await screen.findByRole(Gtk.AccessibleRole.SPIN_BUTTON, { value: { now: 0 } })).toHaveValue(0);
    });

    it("checks the Enable Search button and enables search on the fonts dropdown when toggled", async () => {
        await renderDemo(listviewSelectionsDemo);
        const check = await screen.findByName("enable-search-check", { as: Gtk.CheckButton });
        await userEvent.click(check);
        expect(check).toBeChecked();
        const fonts = await findFontsDropDown();
        expect(fonts).toHaveObjectProperty("enableSearch", true);
    });

    it("updates the entry text when text is typed into the suggestion entry", async () => {
        const entry = await renderWordsEntry();
        await userEvent.type(entry, "GNOME");
        expect(entry).toHaveDisplayValue("GNOME");
    });

    it("clears the suggestion entry when cleared", async () => {
        const entry = await renderWordsEntry();
        await userEvent.type(entry, "TEXT");
        await userEvent.clear(entry);
        expect(entry).toHaveDisplayValue("");
    });

    it("increments the font-spin value on ArrowUp (rounds and clamps)", async () => {
        await renderDemo(listviewSelectionsDemo);
        const spin = await findFontSpin();
        spin.grabFocus();
        await userEvent.keyboard(spin, "{ArrowUp}{ArrowUp}");
        expect(await screen.findByRole(Gtk.AccessibleRole.SPIN_BUTTON, { value: { now: 2 } })).toHaveValue(2);
    });
});

describe("listviewSelectionsDemo dropdown selections", () => {
    it("updates the Times dropdown selection and its displayed value", async () => {
        await renderDemo(listviewSelectionsDemo);
        const { times } = await findDropDowns();
        expect(times).toHaveObjectProperty("selected", 0);
        await userEvent.selectOptions(times, 2);

        await waitFor(() => {
            expect(times).toHaveObjectProperty("selected", 2);
        });

        expect(within(times).getAllByText("5 minutes")).toHaveLength(1);
        expect(within(times).queryAllByText("1 minute")).toHaveLength(0);
        await expectListedTwiceAfterOpening(times, "5 minutes");
        expect(within(times).getAllByText("1 minute")).toHaveLength(1);
    });

    it("updates the sectioned Times dropdown selection across the minutes section", async () => {
        await renderDemo(listviewSelectionsDemo);
        const { timesSectioned } = await findDropDowns();
        expect(timesSectioned).toHaveObjectProperty("selected", 0);
        await userEvent.selectOptions(timesSectioned, 5);

        await waitFor(() => {
            expect(timesSectioned).toHaveObjectProperty("selected", 5);
        });

        expect(within(timesSectioned).getAllByText("20 minutes")).toHaveLength(1);
        await expectListedTwiceAfterOpening(timesSectioned, "20 minutes");
    });

    it("updates the Devices dropdown selection and its displayed device", async () => {
        await renderDemo(listviewSelectionsDemo);
        const { devices } = await findDropDowns();
        expect(devices).toHaveObjectProperty("selected", 0);
        await userEvent.selectOptions(devices, 1);

        await waitFor(() => {
            expect(devices).toHaveObjectProperty("selected", 1);
        });

        expect(within(devices).getAllByText("Headphones")).toHaveLength(1);
        await expectListedTwiceAfterOpening(devices, "Headphones");
    });

    it("syncs the font spin value when a font is chosen from the fonts dropdown", async () => {
        await renderDemo(listviewSelectionsDemo);
        const { fonts } = await findDropDowns();
        const spin = await findFontSpin();
        expect(spin).toHaveObjectProperty("value", 0);
        await userEvent.selectOptions(fonts, 3);

        await waitFor(() => {
            expect(fonts).toHaveObjectProperty("selected", 3);
        });

        await screen.findByRole(Gtk.AccessibleRole.SPIN_BUTTON, { value: { now: 3 } });
    });
});

describe("listviewSelectionsDemo suggestion popover", () => {
    it("opens the suggestion popover and renders matching rows after typing", async () => {
        const entry = await renderWordsEntry();
        await userEvent.type(entry, "gnom");
        const popover = await screen.findByName("words-entry-popover", { as: Gtk.Popover });

        await waitFor(() => {
            expect(popover).toBeVisible();
        });

        const rows = screen.getAllByRole(Gtk.AccessibleRole.LIST_ITEM);
        expect(rows).toHaveLength(3);
        expect(rowLabelText(rows[0] as Gtk.Widget)).toBe("GNOME");
    });

    it("selects the first suggestion row when the Down arrow is pressed", async () => {
        const entry = await renderWordsEntry();
        await userEvent.type(entry, "gnom");
        await userEvent.keyboard(entry, "{ArrowDown}");
        const selected = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { selected: true });
        expect(rowLabelText(selected)).toBe("GNOME");
    });

    it("wraps to the last suggestion row on Down then Up", async () => {
        const entry = await renderWordsEntry();
        await userEvent.type(entry, "tot");
        await userEvent.keyboard(entry, "{ArrowDown}");
        await userEvent.keyboard(entry, "{ArrowUp}");
        const selected = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { selected: true });
        expect(rowLabelText(selected)).toBe("totem pole");
    });
});

describe("listviewSelectionsDemo suggestion acceptance", () => {
    it("writes the selected suggestion into the entry when Enter is pressed", async () => {
        const entry = await renderWordsEntry();
        await userEvent.type(entry, "GNOM");
        await userEvent.keyboard(entry, "{ArrowDown}{Enter}");

        await waitFor(() => {
            expect(entry).toHaveDisplayValue("GNOME");
        });
    });

    it("writes a suggestion into the entry when its row is clicked", async () => {
        const entry = await renderWordsEntry();
        await userEvent.type(entry, "gnom");
        const rows = screen.getAllByRole(Gtk.AccessibleRole.LIST_ITEM);
        await userEvent.click(rows[1] as Gtk.Widget);

        await waitFor(() => {
            expect(entry).toHaveDisplayValue("gnominious");
        });
    });

    it("hides the suggestion popover when Escape is pressed", async () => {
        const entry = await renderWordsEntry();
        await userEvent.type(entry, "tot");
        const popover = await screen.findByName("words-entry-popover", { as: Gtk.Popover });

        await waitFor(() => {
            expect(popover).toBeVisible();
        });

        await userEvent.keyboard(entry, "{Escape}");

        await waitFor(() => {
            expect(popover).not.toBeVisible();
        });
    });
});

describe("listviewSelectionsDemo suggestion clearing", () => {
    it("clears the suggestion list when the entry is cleared after typing", async () => {
        const entry = await renderWordsEntry();
        await userEvent.type(entry, "ttt");
        await userEvent.clear(entry);
        expect(entry).toHaveDisplayValue("");

        await waitFor(() => {
            expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM)).toBeNull();
        });
    });

    it("ignores Down arrow keypress when there are no current suggestions", async () => {
        const entry = await renderWordsEntry();
        await userEvent.keyboard(entry, "{ArrowDown}");
        expect(entry).toHaveDisplayValue("");
    });
});

describe("listviewSelectionsDemo second suggestion entry", () => {
    it("accepts a destination suggestion via keyboard navigation", async () => {
        await renderDemo(listviewSelectionsDemo);
        const entry = await screen.findByPlaceholderText("Destination", { as: Gtk.Entry });
        await userEvent.type(entry, "mock");
        await userEvent.keyboard(entry, "{ArrowDown}{Enter}");

        await waitFor(() => {
            expect(entry).toHaveDisplayValue("app-mockups");
        });
    });
});

describe("listviewSelectionsDemo directory suggestion entry", () => {
    it("updates the directory entry text when text is typed", async () => {
        const entry = await renderDirectoryEntry();
        await userEvent.type(entry, "hello");
        expect(entry).toHaveDisplayValue("hello");
    });

    it("fills the directory entry with a directory name when a suggestion button is clicked", async () => {
        const entry = await renderDirectoryEntry();
        const menuButton = await screen.findByName("directory-menu-button", { as: Gtk.MenuButton });
        const popover = menuButton.getPopover() as Gtk.Popover;
        popover.popup();

        const target = readdirSync(process.cwd()).includes("package.json")
            ? "package.json"
            : (readdirSync(process.cwd()).toSorted((a, b) => a.localeCompare(b))[0] as string);

        const label = within(popover).getByText(target);
        const button = label.getParent() as Gtk.Button;
        await userEvent.click(button);

        await waitFor(() => {
            expect(entry).toHaveDisplayValue(target);
        });
    });
});

describe("listviewSelectionsDemo font spin button", () => {
    it("moves the fonts dropdown selection when the spin button value increases", async () => {
        await renderDemo(listviewSelectionsDemo);
        const spin = await findFontSpin();
        const fonts = await findFontsDropDown();
        expect(fonts).toHaveObjectProperty("selected", 0);
        spin.grabFocus();
        await userEvent.keyboard(spin, "{ArrowUp}");
        await screen.findByRole(Gtk.AccessibleRole.SPIN_BUTTON, { value: { now: 1 } });

        await waitFor(() => {
            expect(fonts).toHaveObjectProperty("selected", 1);
        });
    });

    it("ignores spin button values out of range", async () => {
        await renderDemo(listviewSelectionsDemo);
        const spin = await findFontSpin();
        const fonts = await findFontsDropDown();
        spin.grabFocus();
        await userEvent.keyboard(spin, "{ArrowDown}");
        await screen.findByRole(Gtk.AccessibleRole.SPIN_BUTTON, { value: { now: -1 } });
        expect(fonts).toHaveObjectProperty("selected", 0);
    });
});
