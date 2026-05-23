import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { listviewWeatherDemo } from "../../../src/demos/lists/listview-weather.js";
import { renderDemo, screen } from "../../test-utils.js";

describe("listviewWeatherDemo", () => {
    it("exposes the expected metadata", () => {
        expect(listviewWeatherDemo.id).toBe("listview-weather");
        expect(listviewWeatherDemo.title).toBe("Lists/Weather");
        expect(listviewWeatherDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewWeatherDemo.keywords)).toBe(true);
        expect(typeof listviewWeatherDemo.sourceCode).toBe("string");
        expect(listviewWeatherDemo.defaultWidth).toBe(600);
        expect(listviewWeatherDemo.defaultHeight).toBe(400);
        expect(listviewWeatherDemo.component).toBeTypeOf("function");
    });

    it("renders a horizontal GtkListView with separators and no selection", async () => {
        await renderDemo(listviewWeatherDemo);
        const lv = (await screen.findByName("list-view")) as Gtk.ListView;
        expect(lv).toBeInstanceOf(Gtk.ListView);
        expect(lv.getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
        expect(lv.getShowSeparators()).toBe(true);
    });

    it("uses a no-selection model", async () => {
        await renderDemo(listviewWeatherDemo);
        const lv = (await screen.findByName("list-view")) as Gtk.ListView;
        expect(lv.getModel()).toBeInstanceOf(Gtk.NoSelection);
    });

    it("populates the list view with parsed weather entries", async () => {
        await renderDemo(listviewWeatherDemo);
        const lv = (await screen.findByName("list-view")) as Gtk.ListView;
        const model = lv.getModel();
        const count = model?.getNItems() ?? 0;
        expect(count).toBeGreaterThan(0);
    });

    it("wraps the list view inside a scrolled window with vexpand and hexpand", async () => {
        await renderDemo(listviewWeatherDemo);
        const sw = (await screen.findByName("scrolled")) as Gtk.ScrolledWindow;
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        expect(sw.getVexpand()).toBe(true);
        expect(sw.getHexpand()).toBe(true);
    });
});
