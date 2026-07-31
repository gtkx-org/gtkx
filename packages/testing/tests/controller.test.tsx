import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox } from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import {
    getAllControllers,
    getController,
    queryAllControllers,
    queryController,
    render,
    screen,
} from "../src/index.js";

const renderSurface = async (): Promise<Gtk.Widget> => {
    await render(<GtkBox name="surface" />);

    return screen.findByName("surface");
};

const renderDraggableSurface = async (): Promise<Gtk.Widget> => {
    const surface = await renderSurface();
    surface.addController(new Gtk.GestureDrag());

    return surface;
};

describe("event controller helpers", () => {
    it("getController returns the attached controller", async () => {
        const surface = await renderDraggableSurface();
        expect(getController(surface, Gtk.GestureDrag)).toBeInstanceOf(Gtk.GestureDrag);
    });

    it("getAllControllers returns every controller of that type", async () => {
        const surface = await renderDraggableSurface();
        expect(getAllControllers(surface, Gtk.GestureDrag)).toHaveLength(1);
    });

    it("queryController finds the attached controller", async () => {
        const surface = await renderDraggableSurface();
        expect(queryController(surface, Gtk.GestureDrag)).toBeInstanceOf(Gtk.GestureDrag);
    });

    it("queryController returns null when none is attached", async () => {
        const surface = await renderSurface();
        expect(queryController(surface, Gtk.GestureDrag)).toBeNull();
    });

    it("queryAllControllers returns an empty list when none is attached", async () => {
        const surface = await renderSurface();
        expect(queryAllControllers(surface, Gtk.GestureDrag)).toEqual([]);
    });

    it("getController throws when none is attached", async () => {
        const surface = await renderSurface();

        expect(() => getController(surface, Gtk.GestureDrag)).toThrow(
            "No GestureDrag controller is attached to the widget",
        );
    });

    it("getAllControllers throws when none is attached", async () => {
        const surface = await renderSurface();

        expect(() => getAllControllers(surface, Gtk.GestureDrag)).toThrow(
            "No GestureDrag controller is attached to the widget",
        );
    });
});
