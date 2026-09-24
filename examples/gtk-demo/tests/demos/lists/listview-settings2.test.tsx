import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewSettings2Demo } from "../../../src/demos/lists/listview-settings2.js";
import { openSearchEntry, renderDemo } from "../../test-utils.js";

const schemaId = "org.gtkx.test.settings";

const findValueEntry = async (key: string): Promise<Gtk.Entry> => {
    const search = await openSearchEntry();
    await userEvent.type(search, key);

    return await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, {
        name: `Value for ${schemaId}/${key}`,
        as: Gtk.Entry,
    });
};

const replaceValue = async (entry: Gtk.Entry, text: string) => {
    await userEvent.clear(entry);
    await userEvent.type(entry, text);
};

describe("listviewSettings2Demo", () => {
    it("groups settings into visible schema sections", async () => {
        await renderDemo(listviewSettings2Demo);
        const search = await openSearchEntry();
        await userEvent.type(search, schemaId);
        expect(await screen.findByText(schemaId)).toBeVisible();
        expect(await screen.findByText("clock-format")).toBeVisible();
    });

    it("clears the search and closes its toggle when Escape is pressed", async () => {
        await renderDemo(listviewSettings2Demo);
        const list = await screen.findByName("list-view", { as: Gtk.ListView });
        const search = await openSearchEntry();
        await userEvent.type(search, "zzqxnomatchforanyschemaorkey");
        await waitFor(() => {
            expect(within(list).queryAllByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveLength(0);
        });
        await userEvent.keyboard(search, "{Escape}");
        await waitFor(() => {
            expect(screen.getByName("search-toggle", { as: Gtk.ToggleButton })).not.toBePressed();
            expect(within(list).queryAllByRole(Gtk.AccessibleRole.TEXT_BOX).length).toBeGreaterThan(0);
        });
        await openSearchEntry();
        expect(screen.getByName("search-entry")).toHaveDisplayValue("");
    });

    it("allows a complete multi-character value before committing on Enter", async () => {
        const settings = Gio.Settings.new(schemaId);
        const original = settings.getValue("cursor-size");

        try {
            await renderDemo(listviewSettings2Demo);
            const entry = await findValueEntry("cursor-size");
            await replaceValue(entry, "48");
            expect(entry).toHaveDisplayValue("48");
            expect(settings.getValue("cursor-size").equal(original)).toBe(true);
            await userEvent.keyboard(entry, "{Enter}");
            await waitFor(() => {
                expect(settings.getInt("cursor-size")).toBe(48);
            });
        } finally {
            settings.setValue("cursor-size", original);
        }
    });

    it("commits a value when keyboard focus leaves the entry", async () => {
        const settings = Gio.Settings.new(schemaId);
        const original = settings.getValue("cursor-size");

        try {
            await renderDemo(listviewSettings2Demo);
            const entry = await findValueEntry("cursor-size");
            await replaceValue(entry, "64");
            await userEvent.tab(entry);
            await waitFor(() => {
                expect(settings.getInt("cursor-size")).toBe(64);
            });
        } finally {
            settings.setValue("cursor-size", original);
        }
    });

    it.each(["invalid", "'unsupported'"])("rejects an invalid clock format %s", async (value) => {
        const settings = Gio.Settings.new(schemaId);
        const original = settings.getValue("clock-format");
        await renderDemo(listviewSettings2Demo);
        const entry = await findValueEntry("clock-format");
        await replaceValue(entry, value);
        await userEvent.keyboard(entry, "{Enter}");
        expect(entry).toHaveDisplayValue(original.print(false));
        expect(settings.getValue("clock-format").equal(original)).toBe(true);
    });

    it("reads current settings when the demo is reopened", async () => {
        const settings = Gio.Settings.new(schemaId);
        const original = settings.getValue("cursor-size");

        try {
            const first = await renderDemo(listviewSettings2Demo);
            await findValueEntry("cursor-size");
            await first.unmount();
            settings.setInt("cursor-size", 72);
            await renderDemo(listviewSettings2Demo);
            expect(await findValueEntry("cursor-size")).toHaveDisplayValue("72");
        } finally {
            settings.setValue("cursor-size", original);
        }
    });
});
