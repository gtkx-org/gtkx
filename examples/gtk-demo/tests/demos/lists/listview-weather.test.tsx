import * as Gtk from "@gtkx/gi/gtk";
import { screen, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewWeatherDemo } from "../../../src/demos/lists/listview-weather.js";
import { renderDemo } from "../../test-utils.js";

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

    it("populates the list view with at least one full day of hourly weather entries", async () => {
        await renderDemo(listviewWeatherDemo);
        const lv = (await screen.findByName("list-view")) as Gtk.ListView;
        const model = lv.getModel() as Gtk.SelectionModel;
        expect(model.getNItems()).toBeGreaterThanOrEqual(24);
    });

    it("wraps the list view inside a scrolled window with vexpand and hexpand", async () => {
        await renderDemo(listviewWeatherDemo);
        const sw = (await screen.findByName("scrolled")) as Gtk.ScrolledWindow;
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        expect(sw.getVexpand()).toBe(true);
        expect(sw.getHexpand()).toBe(true);
    });

    it("renders weather icon images from the symbolic icon set", async () => {
        await renderDemo(listviewWeatherDemo);
        const lv = (await screen.findByName("list-view")) as Gtk.ListView;
        const images = within(lv).getAllByRole(Gtk.AccessibleRole.IMG) as Gtk.Image[];
        expect(images.length).toBeGreaterThan(0);
        for (const image of images) {
            expect(image.getIconSize()).toBe(Gtk.IconSize.LARGE);
            expect(image.getIconName() ?? "").toMatch(/^weather-/);
        }
    });

    it("renders hour and temperature labels in the materialized cells", async () => {
        await renderDemo(listviewWeatherDemo);
        const lv = (await screen.findByName("list-view")) as Gtk.ListView;
        const labels = within(lv).getAllByRole(Gtk.AccessibleRole.LABEL) as Gtk.Label[];
        const hourLabels = labels.filter((label) => /^\d{2}:\d{2}$/.test(label.getLabel() ?? ""));
        const tempLabels = labels.filter((label) => /^-?\d+°$/.test(label.getLabel() ?? ""));
        expect(hourLabels.length, "expected at least one HH:MM label").toBeGreaterThan(0);
        expect(tempLabels.length, "expected at least one temperature label").toBeGreaterThan(0);
    });
});
