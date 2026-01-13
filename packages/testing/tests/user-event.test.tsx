import { getNativeObject } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkDropDown,
    GtkEntry,
    GtkListBox,
    GtkListBoxRow,
    GtkSwitch,
    GtkToggleButton,
    x,
} from "@gtkx/react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "../src/index.js";

describe("userEvent.click", () => {
    it("emits clicked signal on button", async () => {
        const handleClick = vi.fn();
        await render(<GtkButton label="Click me" onClicked={handleClick} />);

        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click me" });
        await userEvent.click(button);

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("toggles checkbox state", async () => {
        await render(<GtkCheckButton label="Option" />);

        const checkbox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX);
        await userEvent.click(checkbox);

        const checked = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: true });
        expect(checked).toBeDefined();
    });

    it("toggles switch state", async () => {
        await render(<GtkSwitch />);

        const switchWidget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
        await userEvent.click(switchWidget);

        const active = await screen.findByRole(Gtk.AccessibleRole.SWITCH, { checked: true });
        expect(active).toBeDefined();
    });

    it("toggles toggle button state", async () => {
        await render(<GtkToggleButton label="Toggle" />);

        const toggle = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON);
        await userEvent.click(toggle);

        const active = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { checked: true });
        expect(active).toBeDefined();
    });
});

describe("userEvent.dblClick", () => {
    it("emits clicked signal twice", async () => {
        const handleClick = vi.fn();
        await render(<GtkButton label="Double click me" onClicked={handleClick} />);

        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Double click me" });
        await userEvent.dblClick(button);

        expect(handleClick).toHaveBeenCalledTimes(2);
    });
});

describe("userEvent.tripleClick", () => {
    it("emits clicked signal three times", async () => {
        const handleClick = vi.fn();
        await render(<GtkButton label="Triple click me" onClicked={handleClick} />);

        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Triple click me" });
        await userEvent.tripleClick(button);

        expect(handleClick).toHaveBeenCalledTimes(3);
    });
});

describe("userEvent.type", () => {
    it("types text into entry", async () => {
        await render(<GtkEntry />);

        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.type(entry, "Hello World");

        const editable = getNativeObject(entry.handle, Gtk.Editable);
        expect(editable?.getText()).toBe("Hello World");
    });

    it("appends text to existing content", async () => {
        await render(<GtkEntry text="Initial " />);

        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.type(entry, "appended");

        const editable = getNativeObject(entry.handle, Gtk.Editable);
        expect(editable?.getText()).toBe("Initial appended");
    });

    describe("error handling", () => {
        it("throws when element is not editable", async () => {
            await render(<GtkButton label="Test" />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Test" });
            await expect(userEvent.type(button, "text")).rejects.toThrow(
                "Cannot type into element: expected editable widget (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)",
            );
        });
    });
});

describe("userEvent.clear", () => {
    it("clears text from entry", async () => {
        await render(<GtkEntry text="Some text" />);

        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await userEvent.clear(entry);

        const editable = getNativeObject(entry.handle, Gtk.Editable);
        expect(editable?.getText()).toBe("");
    });

    describe("error handling", () => {
        it("throws when element is not editable", async () => {
            await render(<GtkButton label="Test" />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Test" });
            await expect(userEvent.clear(button)).rejects.toThrow(
                "Cannot clear element: expected editable widget (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)",
            );
        });
    });
});

describe("userEvent.tab", () => {
    it("moves focus forward", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="First" />
                <GtkButton label="Second" />
            </GtkBox>,
        );

        const first = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "First" });
        first.grabFocus();
        await userEvent.tab(first);
    });

    it("moves focus backward with shift option", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="First" />
                <GtkButton label="Second" />
            </GtkBox>,
        );

        const second = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Second" });
        second.grabFocus();
        await userEvent.tab(second, { shift: true });
    });
});

describe("userEvent.selectOptions", () => {
    it("selects option in dropdown by index", async () => {
        await render(
            <GtkDropDown>
                <x.SimpleListItem id="a" value="Option A" />
                <x.SimpleListItem id="b" value="Option B" />
                <x.SimpleListItem id="c" value="Option C" />
            </GtkDropDown>,
        );

        const dropdown = await screen.findByRole(Gtk.AccessibleRole.COMBO_BOX);
        await userEvent.selectOptions(dropdown, 1);
    });

    it("selects row in list box by index", async () => {
        await render(
            <GtkListBox>
                <GtkListBoxRow>Item 1</GtkListBoxRow>
                <GtkListBoxRow>Item 2</GtkListBoxRow>
            </GtkListBox>,
        );

        const listBox = await screen.findByRole(Gtk.AccessibleRole.LIST);
        await userEvent.selectOptions(listBox, 0);
    });

    describe("error handling", () => {
        it("throws when element is not selectable", async () => {
            await render(<GtkButton label="Test" />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Test" });
            await expect(userEvent.selectOptions(button, 0)).rejects.toThrow(
                "Cannot select options: expected selectable widget (COMBO_BOX or LIST)",
            );
        });

        it("throws when selecting multiple options on dropdown", async () => {
            await render(
                <GtkDropDown>
                    <x.SimpleListItem id="a" value="A" />
                    <x.SimpleListItem id="b" value="B" />
                </GtkDropDown>,
            );

            const dropdown = await screen.findByRole(Gtk.AccessibleRole.COMBO_BOX);
            await expect(userEvent.selectOptions(dropdown, [0, 1])).rejects.toThrow(
                "Cannot select multiple options: ComboBox only supports single selection",
            );
        });
    });
});

describe("userEvent.deselectOptions", () => {
    it("deselects row in list box", async () => {
        await render(
            <GtkListBox selectionMode={Gtk.SelectionMode.MULTIPLE}>
                <GtkListBoxRow>Item 1</GtkListBoxRow>
                <GtkListBoxRow>Item 2</GtkListBoxRow>
            </GtkListBox>,
        );

        const listBox = await screen.findByRole(Gtk.AccessibleRole.LIST);
        await userEvent.selectOptions(listBox, [0, 1]);
        await userEvent.deselectOptions(listBox, 0);
    });

    describe("error handling", () => {
        it("throws when element is not a list box", async () => {
            await render(
                <GtkDropDown>
                    <x.SimpleListItem id="a" value="A" />
                </GtkDropDown>,
            );

            const dropdown = await screen.findByRole(Gtk.AccessibleRole.COMBO_BOX);
            await expect(userEvent.deselectOptions(dropdown, 0)).rejects.toThrow(
                "Cannot deselect options: only ListBox supports deselection",
            );
        });
    });
});
