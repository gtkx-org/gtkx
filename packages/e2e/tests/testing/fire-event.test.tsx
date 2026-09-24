import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkAdjustment,
    GtkBox,
    GtkGestureDrag,
    GtkListView,
    GtkNoSelection,
    GtkScale,
    GtkStringList,
    GtkTextBuffer,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import {
    fireEvent,
    getAllControllers,
    getController,
    queryAllControllers,
    queryController,
    render,
    screen,
    userEvent,
} from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { itemFactory } from "../helpers/list-view-render.js";
import { renderClickButton } from "./event-render-setup.js";
import { bufferText, caretOffset } from "./text-buffer-helpers.js";

const renderSurface = async (controllers?: ReactNode): Promise<Gtk.Widget> => {
    await render(<GtkBox name="surface" controllers={controllers} />);

    return screen.findByName("surface");
};

describe("fireEvent", () => {
    it("emits the signal once per call and resolves after each emission", async () => {
        const { clicks, button } = await renderClickButton();
        const emission = fireEvent(button, "clicked");
        await emission;
        expect(clicks.count).toBe(1);
        await fireEvent(button, "clicked");
        await fireEvent(button, "clicked");
        expect(clicks.count).toBe(3);
    });
});

describe("keyboard drives real widget key bindings", () => {
    it("moves a Gtk.Scale via arrow, page, home and end keys", async () => {
        await render(
            <GtkScale
                adjustment={<GtkAdjustment value={20} lower={0} upper={100} stepIncrement={1} pageIncrement={10} />}
            />,
        );

        const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
        scale.grabFocus();
        await userEvent.keyboard(scale, "{ArrowUp}");
        expect(scale.getValue()).toBe(21);
        await userEvent.keyboard(scale, "{PageUp}");
        expect(scale.getValue()).toBe(31);
        await userEvent.keyboard(scale, "{End}");
        expect(scale.getValue()).toBe(100);
        await userEvent.keyboard(scale, "{Home}");
        expect(scale.getValue()).toBe(0);
    });

    it("moves the TextView caret and undoes typing via keyboard", async () => {
        await render(<GtkTextView buffer={<GtkTextBuffer enableUndo />} />);
        const view = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
        view.grabFocus();
        await userEvent.type(view, "hello");
        expect(bufferText(view)).toBe("hello");
        expect(caretOffset(view)).toBe(5);
        await userEvent.keyboard(view, "{ArrowLeft}{ArrowLeft}");
        expect(caretOffset(view)).toBe(3);
        await userEvent.keyboard(view, "{Home}");
        expect(caretOffset(view)).toBe(0);
        await userEvent.keyboard(view, "{End}");
        expect(caretOffset(view)).toBe(5);
        await userEvent.keyboard(view, "{Control>}z{/Control}");
        expect(bufferText(view)).toBe("");
    });

    it("activates a ListView row via arrow navigation and Enter", async () => {
        const activated: number[] = [];
        const ref = createRef<Gtk.ListView>();

        await render(
            <GtkListView
                ref={ref}
                model={<GtkNoSelection model={<GtkStringList strings={["Alpha", "Beta"]} />} />}
                factory={itemFactory()}
                onActivate={(position) => {
                    activated.push(position);
                }}
            />,
        );

        const view = ref.current as Gtk.ListView;
        view.grabFocus();
        await userEvent.keyboard(view, "{Enter}");
        expect(activated).toEqual([0]);
        await userEvent.keyboard(view, "{ArrowDown}{Enter}");
        expect(activated).toEqual([0, 1]);
    });
});

describe("event controller helpers", () => {
    it("find the controllers attached to a widget", async () => {
        const surface = await renderSurface(<GtkGestureDrag />);
        const gesture = getController(surface, Gtk.GestureDrag);
        expect(getController(surface, Gtk.GestureDrag)).toBe(gesture);
        expect(getAllControllers(surface, Gtk.GestureDrag)).toEqual([gesture]);
        expect(queryController(surface, Gtk.GestureDrag)).toBe(gesture);
        expect(queryAllControllers(surface, Gtk.GestureDrag)).toEqual([gesture]);
    });

    it("report nothing, and the get variants throw, when none is attached", async () => {
        const surface = await renderSurface();
        expect(queryController(surface, Gtk.GestureDrag)).toBeNull();
        expect(queryAllControllers(surface, Gtk.GestureDrag)).toEqual([]);
        expect(() => getController(surface, Gtk.GestureDrag)).toThrow();
        expect(() => getAllControllers(surface, Gtk.GestureDrag)).toThrow();
    });
});
