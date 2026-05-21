import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { listviewApplauncherDemo } from "../../../src/demos/lists/listview-applauncher.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAll, findFirst } from "./helpers.js";

describe("listviewApplauncherDemo", () => {
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

    it("wraps a single GtkListView inside a scrolled window", async () => {
        if (!listviewApplauncherDemo.component) throw new Error("listview-applauncher demo component missing");
        const { container } = await renderDemo(listviewApplauncherDemo.component);
        const sw = findFirst(container, Gtk.ScrolledWindow);
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        const listViews = findAll(container, Gtk.ListView);
        expect(listViews.length).toBe(1);
    });

    it("uses single selection mode on the list view", async () => {
        if (!listviewApplauncherDemo.component) throw new Error("listview-applauncher demo component missing");
        const { container } = await renderDemo(listviewApplauncherDemo.component);
        const listView = findFirst(container, Gtk.ListView);
        if (!listView) throw new Error("list view not rendered");
        const model = listView.getModel();
        expect(model).toBeInstanceOf(Gtk.SingleSelection);
    });

    it("renders one row per application returned by Gio.appInfoGetAll", async () => {
        if (!listviewApplauncherDemo.component) throw new Error("listview-applauncher demo component missing");
        const { container } = await renderDemo(listviewApplauncherDemo.component);
        const listView = findFirst(container, Gtk.ListView);
        if (!listView) throw new Error("list view not rendered");
        const model = listView.getModel();
        if (!model) throw new Error("list view has no model");
        const expectedCount = Gio.appInfoGetAll().length;
        expect(model.getNItems()).toBe(expectedCount);
    });
});
