import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { listviewWeatherDemo } from "../../../src/demos/lists/listview-weather.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findFirst } from "./helpers.js";

describe("listviewWeatherDemo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(listviewWeatherDemo, { id: "listview-weather", title: "Lists/Weather" });
        expect(typeof listviewWeatherDemo.sourceCode).toBe("string");
        expect(listviewWeatherDemo.keywords).toContain("listview");
        expect(listviewWeatherDemo.keywords).toContain("weather");
        expect(listviewWeatherDemo.keywords).toContain("horizontal");
        expect(listviewWeatherDemo.defaultWidth).toBe(600);
        expect(listviewWeatherDemo.defaultHeight).toBe(400);
        expect(listviewWeatherDemo.component).toBeTypeOf("function");
    });

    it("renders a horizontal GtkListView with separators and no selection", async () => {
        if (!listviewWeatherDemo.component) throw new Error("listview-weather demo component missing");
        const { container } = await renderDemo(listviewWeatherDemo.component);
        const lv = findFirst(container, Gtk.ListView);
        expect(lv).toBeInstanceOf(Gtk.ListView);
        expect(lv?.getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
        expect(lv?.getShowSeparators()).toBe(true);
    });

    it("uses a no-selection model", async () => {
        if (!listviewWeatherDemo.component) throw new Error("listview-weather demo component missing");
        const { container } = await renderDemo(listviewWeatherDemo.component);
        const lv = findFirst(container, Gtk.ListView);
        expect(lv?.getModel()).toBeInstanceOf(Gtk.NoSelection);
    });

    it("populates the list view with parsed weather entries", async () => {
        if (!listviewWeatherDemo.component) throw new Error("listview-weather demo component missing");
        const { container } = await renderDemo(listviewWeatherDemo.component);
        const lv = findFirst(container, Gtk.ListView);
        const model = lv?.getModel();
        const count = model?.getNItems() ?? 0;
        expect(count).toBeGreaterThan(0);
    });

    it("wraps the list view inside a scrolled window with vexpand and hexpand", async () => {
        if (!listviewWeatherDemo.component) throw new Error("listview-weather demo component missing");
        const { container } = await renderDemo(listviewWeatherDemo.component);
        const sw = findFirst(container, Gtk.ScrolledWindow);
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        expect(sw?.getVexpand()).toBe(true);
        expect(sw?.getHexpand()).toBe(true);
    });
});
