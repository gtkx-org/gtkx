import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewSettingsDemo } from "../../../src/demos/lists/listview-settings.js";
import { collectWidgets, openSearchEntry, renderDemo } from "../../test-utils.js";

const schemaId = "org.gtkx.test.settings";
const groupsSchemaId = "org.gtkx.test.settings.groups";

const selectSchema = async (id: string) => {
    const sidebar = await screen.findByName("sidebar", { as: Gtk.ListView });
    await userEvent.scroll(sidebar, { y: -100_000 });

    for (let page = 0; page < 50; page++) {
        const label = within(sidebar).queryAllByText(id)[0];

        if (label) {
            await userEvent.click(label);

            return;
        }

        await userEvent.scroll(sidebar, { y: 250 });
    }

    throw new Error(`Schema ${id} was not found`);
};

const findValue = async (key: string): Promise<Gtk.EditableLabel> => {
    const search = screen.queryByName("search-entry", { as: Gtk.SearchEntry }) ?? await openSearchEntry();
    await userEvent.clear(search);
    await userEvent.type(search, key);

    return await screen.findByLabelText(`Value for ${key}`, { as: Gtk.EditableLabel });
};

const editValue = async (entry: Gtk.EditableLabel, text: string) => {
    await userEvent.click(entry);
    await userEvent.keyboard(entry, "{Enter}");
    await userEvent.clear(entry);
    await userEvent.type(entry, text);
    await userEvent.keyboard(entry, "{Enter}");
};

describe("listviewSettingsDemo", () => {
    it("shows the keys of the selected schema", async () => {
        await renderDemo(listviewSettingsDemo);
        await selectSchema(schemaId);
        await findValue("clock-format");
        expect(await screen.findByText("clock-format")).toBeVisible();
        const view = await screen.findByName("column-view", { as: Gtk.ColumnView });
        expect(within(view).getByText("Name")).toBeVisible();
        expect(within(view).getByText("Value")).toBeVisible();
        expect(within(view).getByText("Type")).toBeVisible();
        expect(within(view).queryByText("Summary")).toBeNull();
    });

    it("filters keys and clears the search with Escape", async () => {
        await renderDemo(listviewSettingsDemo);
        await selectSchema(schemaId);
        const search = await openSearchEntry();
        await userEvent.type(search, "clock-format");
        await waitFor(() => {
            expect(screen.queryByText("cursor-size")).toBeNull();
        });
        expect(screen.getByText("clock-format")).toBeVisible();
        await userEvent.keyboard(search, "{Escape}");
        const searchAgain = await openSearchEntry();
        expect(searchAgain).toHaveDisplayValue("");
        await userEvent.keyboard(searchAgain, "{Escape}");
        expect(screen.getByName("search-toggle", { as: Gtk.ToggleButton })).not.toBePressed();
    });

    it("edits a boolean and retains it after changing schemas", async () => {
        const settings = Gio.Settings.new(schemaId);
        const original = settings.getValue("clock-show-seconds");
        const changed = original.print(false) === "true" ? "false" : "true";

        try {
            await renderDemo(listviewSettingsDemo);
            await selectSchema(schemaId);
            await editValue(await findValue("clock-show-seconds"), changed);
            expect(settings.getValue("clock-show-seconds").print(false)).toBe(changed);
            await selectSchema(groupsSchemaId);
            await selectSchema(schemaId);
            expect(await findValue("clock-show-seconds")).toHaveObjectProperty("text", changed);
        } finally {
            settings.setValue("clock-show-seconds", original);
        }
    });

    it.each(["invalid", "'unsupported'"])("rejects an invalid clock format %s", async (value) => {
        const settings = Gio.Settings.new(schemaId);
        const original = settings.getValue("clock-format");
        await renderDemo(listviewSettingsDemo);
        await selectSchema(schemaId);
        const entry = await findValue("clock-format");
        await editValue(entry, value);
        expect(entry).toHaveObjectProperty("text", original.print(false));
        expect(settings.getValue("clock-format").equal(original)).toBe(true);
    });

    it("loads and edits a child whose schema ID differs from its name", async () => {
        const settings = Gio.Settings.new(groupsSchemaId).getChild("output");
        const original = settings.getValue("enabled");
        const changed = original.print(false) === "true" ? "false" : "true";

        try {
            await renderDemo(listviewSettingsDemo);
            await selectSchema(`${groupsSchemaId}/output`);
            await editValue(await findValue("enabled"), changed);
            expect(settings.getValue("enabled").print(false)).toBe(changed);
        } finally {
            settings.setValue("enabled", original);
        }
    });

    it("keeps a schema collapsed after selection changes", async () => {
        await renderDemo(listviewSettingsDemo);
        await selectSchema(groupsSchemaId);
        const sidebar = screen.getByName("sidebar", { as: Gtk.ListView });
        await userEvent.click(within(sidebar).getByRole(Gtk.AccessibleRole.BUTTON, {
            name: groupsSchemaId,
            as: Gtk.TreeExpander,
        }));
        await waitFor(() => {
            expect(screen.queryAllByText(`${groupsSchemaId}/output`)).toHaveLength(0);
        });
        await selectSchema(schemaId);
        expect(screen.queryAllByText(`${groupsSchemaId}/output`)).toHaveLength(0);
        await selectSchema(groupsSchemaId);
        await userEvent.click(within(sidebar).getByRole(Gtk.AccessibleRole.BUTTON, {
            name: groupsSchemaId,
            as: Gtk.TreeExpander,
        }));
        const children = await screen.findAllByText(`${groupsSchemaId}/output`);
        expect(children.length).toBeGreaterThan(0);
    });

    it("sorts displayed values by their type when the Type header is clicked", async () => {
        await renderDemo(listviewSettingsDemo);
        await selectSchema(schemaId);
        const view = screen.getByName("column-view", { as: Gtk.ColumnView });
        const header = within(view).getByText("Type");
        const types = () => collectWidgets(view, Gtk.Label).map((label) => label.getText()).filter((text) =>
            ["s", "b", "i", "u", "d", "as"].includes(text),
        );
        await userEvent.click(header);
        await waitFor(() => {
            expect(types()).toEqual(types().toSorted((a, b) => a.localeCompare(b)));
        });
        await userEvent.click(header);
        await waitFor(() => {
            expect(types()).toEqual(types().toSorted((a, b) => b.localeCompare(a)));
        });
    });
});
