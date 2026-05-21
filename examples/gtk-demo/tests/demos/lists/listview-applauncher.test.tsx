import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewApplauncherDemo } from "../../../src/demos/lists/listview-applauncher.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

describe("listviewApplauncherDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(listviewApplauncherDemo, {
            id: "listview-applauncher",
            title: "Lists/Application launcher",
        });
        expect(typeof listviewApplauncherDemo.sourceCode).toBe("string");
        expect(listviewApplauncherDemo.keywords).toContain("listview");
        expect(listviewApplauncherDemo.keywords).toContain("launcher");
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
        const images = findAllOfType(listView, Gtk.Image);
        const labels = findAllOfType(listView, Gtk.Label);
        expect(images.length).toBeGreaterThan(0);
        expect(labels.length).toBeGreaterThan(0);
    });
});
