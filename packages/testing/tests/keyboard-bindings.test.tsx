import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkListView, GtkScale, GtkTextView } from "@gtkx/jsx/gtk";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, userEvent } from "../src/index.js";
import { bufferText, caretOffset } from "./text-buffer-helpers.js";

const setupLabelItem = (listItem: GObject.Object): void => {
    if (!(listItem instanceof Gtk.ListItem)) {
        return;
    }

    listItem.setChild(new Gtk.Label());
};

const bindLabelItem = (listItem: GObject.Object): void => {
    if (!(listItem instanceof Gtk.ListItem)) {
        return;
    }

    const label = listItem.getChild();
    const item = listItem.getItem();

    if (label instanceof Gtk.Label && item instanceof Gtk.StringObject) {
        label.setLabel(item.getString());
    }
};

const stringLabelFactory = (): Gtk.SignalListItemFactory => {
    const factory = Gtk.SignalListItemFactory.new();
    factory.on("setup", setupLabelItem);
    factory.on("bind", bindLabelItem);

    return factory;
};

async function renderFocusedScale() {
    await render(
        <GtkScale
            adjustment={<GtkAdjustment value={20} lower={0} upper={100} stepIncrement={1} pageIncrement={10} />}
        />,
    );

    const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
    scale.grabFocus();

    return scale;
}

async function renderFocusedTextView() {
    await render(<GtkTextView />);
    const view = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
    view.getBuffer().setEnableUndo(true);
    view.grabFocus();

    return view;
}

describe("keyboard drives real widget key bindings", () => {
    it("moves a Gtk.Scale via arrow, page, home and end keys", async () => {
        const scale = await renderFocusedScale();
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
        const view = await renderFocusedTextView();
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
                model={Gtk.NoSelection.new(Gtk.StringList.new(["Alpha", "Beta"]))}
                factory={stringLabelFactory()}
                onActivate={(position) => {
                    activated.push(position);
                }}
            />,
        );

        const view = ref.current;
        expect(view).not.toBeNull();
        view?.grabFocus();
        await userEvent.keyboard(view as Gtk.ListView, "{Enter}");
        expect(activated).toEqual([0]);
        await userEvent.keyboard(view as Gtk.ListView, "{ArrowDown}{Enter}");
        expect(activated).toEqual([0, 1]);
    });
});
