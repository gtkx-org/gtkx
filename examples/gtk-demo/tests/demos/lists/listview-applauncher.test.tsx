import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { listviewApplauncherDemo } from "../../../src/demos/lists/listview-applauncher.js";
import { fireEvent, renderDemo, screen, within } from "../../test-utils.js";

describe("listviewApplauncherDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewApplauncherDemo.id).toBe("listview-applauncher");
        expect(listviewApplauncherDemo.title).toBe("Lists/Application launcher");
        expect(listviewApplauncherDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewApplauncherDemo.keywords)).toBe(true);
        expect(typeof listviewApplauncherDemo.sourceCode).toBe("string");
        expect(listviewApplauncherDemo.defaultWidth).toBe(640);
        expect(listviewApplauncherDemo.defaultHeight).toBe(320);
        expect(listviewApplauncherDemo.component).toBeTypeOf("function");
    });
});

describe("listviewApplauncherDemo structure", () => {
    it("wraps a single GtkListView inside a scrolled window", async () => {
        await renderDemo(listviewApplauncherDemo);
        const sw = await screen.findByName("scrolled");
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        const listView = await screen.findByName("list-view");
        expect(listView).toBeInstanceOf(Gtk.ListView);
    });

    it("uses single selection mode on the list view", async () => {
        await renderDemo(listviewApplauncherDemo);
        const listView = (await screen.findByName("list-view")) as Gtk.ListView;
        const model = listView.getModel();
        expect(model).toBeInstanceOf(Gtk.SingleSelection);
    });
});

describe("listviewApplauncherDemo rows", () => {
    it("renders one row per application returned by Gio.appInfoGetAll", async () => {
        await renderDemo(listviewApplauncherDemo);
        const listView = (await screen.findByName("list-view")) as Gtk.ListView;
        const model = listView.getModel();
        if (!model) throw new Error("list view has no model");
        const expectedCount = Gio.appInfoGetAll().length;
        expect(model.getNItems()).toBe(expectedCount);
    });

    it("activates the launch handler when a row is activated", async () => {
        await renderDemo(listviewApplauncherDemo);
        const listView = (await screen.findByName("list-view")) as Gtk.ListView;
        await fireEvent(listView, "activate", 0);
    });

    it("renders icon and label widgets through the list view factory", async () => {
        await renderDemo(listviewApplauncherDemo);
        const listView = (await screen.findByName("list-view")) as Gtk.ListView;
        const images = within(listView).getAllByRole(Gtk.AccessibleRole.IMG);
        expect(images.length).toBeGreaterThan(0);
        const apps = Gio.appInfoGetAll();
        if (apps.length === 0) throw new Error("expected at least one app to be available");
        const firstAppName = apps[0]?.getDisplayName();
        if (!firstAppName) throw new Error("expected first app to have a display name");
        expect(await within(listView).findByText(firstAppName)).toBeInstanceOf(Gtk.Widget);
    });
});
