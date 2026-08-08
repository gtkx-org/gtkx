import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewWeatherDemo } from "../../../src/demos/lists/listview-weather.js";
import { renderDemo } from "../../test-utils.js";

const EXPECTED_ITEM_COUNT = 70_128;

const WEATHER_ICON_NAMES = new Set([
    "weather-clear-symbolic",
    "weather-few-clouds-symbolic",
    "weather-fog-symbolic",
    "weather-overcast-symbolic",
    "weather-showers-scattered-symbolic",
    "weather-showers-symbolic",
    "weather-snow-symbolic",
    "weather-storm-symbolic",
]);

const renderListView = async (): Promise<Gtk.ListView> => {
    await renderDemo(listviewWeatherDemo);

    return await screen.findByName("list-view", { as: Gtk.ListView });
};

describe("listviewWeatherDemo metadata", () => {
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
});

describe("listviewWeatherDemo list view", () => {
    it("renders a horizontal GtkListView with separators and no selection", async () => {
        const lv = await renderListView();
        expect(lv).toHaveObjectProperty("orientation", Gtk.Orientation.HORIZONTAL);
        expect(lv).toHaveObjectProperty("showSeparators", true);
    });

    it("uses a no-selection model", async () => {
        const lv = await renderListView();
        expect(lv.getModel()).toBeInstanceOf(Gtk.NoSelection);
    });

    it("keeps the selection empty when a cell is clicked", async () => {
        const lv = await renderListView();
        const model = lv.getModel() as Gtk.SelectionModel;
        expect(Number(model.getSelection().getSize())).toBe(0);
        const cell = within(lv).getAllByRole(Gtk.AccessibleRole.LIST_ITEM)[0] as Gtk.Widget;
        await userEvent.click(cell);
        expect(Number(model.getSelection().getSize())).toBe(0);
    });

    it("populates the list view with the full deterministic hourly dataset", async () => {
        const lv = await renderListView();
        const model = lv.getModel() as Gtk.SelectionModel;
        expect(model).toHaveObjectProperty("nItems", EXPECTED_ITEM_COUNT);
    });
});

describe("listviewWeatherDemo cell content", () => {
    it("wraps the list view inside the named scrolled window", async () => {
        await renderDemo(listviewWeatherDemo);
        const sw = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        expect(within(sw).getByName("list-view")).toBeInstanceOf(Gtk.ListView);
    });

    it("maps each weather type to a known symbolic weather icon", async () => {
        const lv = await renderListView();
        const images = within(lv).getAllByRole(Gtk.AccessibleRole.IMG, { as: Gtk.Image });
        expect(images.length).toBeGreaterThan(0);

        for (const image of images) {
            expect(image).toHaveObjectProperty("iconSize", Gtk.IconSize.LARGE);
            expect(WEATHER_ICON_NAMES.has(image.getIconName() ?? "")).toBe(true);
        }
    });

    it("renders the first hour cell at midnight and temperature labels in materialized cells", async () => {
        const lv = await renderListView();
        const hourLabels = within(lv).getAllByText(/^\d{2}:\d{2}$/, { as: Gtk.Label });
        const tempLabels = within(lv).getAllByText(/^-?\d+°$/);
        expect(hourLabels.map((label) => label.getText())).toContain("00:00");
        expect(tempLabels.length).toBeGreaterThan(0);
    });
});
