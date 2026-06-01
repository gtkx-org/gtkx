import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listviewApplauncherDemo } from "../../../src/demos/lists/listview-applauncher.js";
import { renderDemo } from "../../test-utils.js";

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
        expect(model).not.toBeNull();
        const expectedCount = Gio.appInfoGetAll().length;
        expect((model as Gtk.SelectionModel).getNItems()).toBe(expectedCount);
    });

    it("invokes Gio.AppInfo.launch when a row is activated", async () => {
        const launchSpy = vi.spyOn(Gio.AppInfo.prototype, "launch").mockReturnValue(true);
        try {
            await renderDemo(listviewApplauncherDemo);
            const listView = (await screen.findByName("list-view")) as Gtk.ListView;
            await fireEvent(listView, "activate", 0);
            await waitFor(() => expect(launchSpy).toHaveBeenCalled());
        } finally {
            launchSpy.mockRestore();
        }
    });

    it("presents an alert dialog when launching the selected app throws", async () => {
        const launchSpy = vi.spyOn(Gio.AppInfo.prototype, "launch").mockImplementation(() => {
            throw new Error("denied by policy");
        });
        try {
            await renderDemo(listviewApplauncherDemo);
            const listView = (await screen.findByName("list-view")) as Gtk.ListView;
            await fireEvent(listView, "activate", 0);
            await waitFor(() => expect(launchSpy).toHaveBeenCalled());
            await screen.findByText("denied by policy");
        } finally {
            launchSpy.mockRestore();
        }
    });

    it("renders icon and label widgets through the list view factory", async () => {
        await renderDemo(listviewApplauncherDemo);
        const listView = (await screen.findByName("list-view")) as Gtk.ListView;
        const images = within(listView).getAllByRole(Gtk.AccessibleRole.IMG);
        expect(images.length).toBeGreaterThan(0);
        const apps = Gio.appInfoGetAll();
        expect(apps.length).toBeGreaterThan(0);
        const firstAppName = apps[0]?.getDisplayName();
        expect(firstAppName).toBeTypeOf("string");
        expect(await within(listView).findByText(firstAppName as string)).toBeInstanceOf(Gtk.Widget);
    });
});
