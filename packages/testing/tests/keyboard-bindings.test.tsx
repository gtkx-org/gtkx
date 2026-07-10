import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkLabel, GtkScale, GtkTextView } from "@gtkx/jsx/gtk";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, userEvent } from "../src/index.js";

type NamedItem = { name: string };

const bufferText = (view: Gtk.TextView): string => {
    const buffer = view.getBuffer();
    const [start, end] = buffer.getBounds();
    return buffer.getText(start, end, true);
};

const caretOffset = (view: Gtk.TextView): number => {
    const buffer = view.getBuffer();
    return buffer.getIterAtMark(buffer.getInsert()).getOffset();
};

describe("keyboard drives real widget key bindings", () => {
    it("moves a Gtk.Scale via arrow, page, home and end keys", async () => {
        await render(
            <GtkScale
                adjustment={<GtkAdjustment value={20} lower={0} upper={100} stepIncrement={1} pageIncrement={10} />}
            />,
        );
        const scale = (await screen.findByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale;
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
        await render(<GtkTextView />);
        const view = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        view.getBuffer().setEnableUndo(true);
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
            <ListView<NamedItem>
                ref={ref}
                items={[
                    { id: "1", value: { name: "Alpha" } },
                    { id: "2", value: { name: "Beta" } },
                ]}
                renderItem={({ item }) => <GtkLabel label={item.name} />}
                onActivate={(position) => activated.push(position)}
            />,
        );
        const view = ref.current;
        expect(view).not.toBeNull();
        view?.grabFocus();

        await userEvent.keyboard(view as Gtk.ListView, "{ArrowDown}{Enter}");
        expect(activated).toEqual([0]);

        await userEvent.keyboard(view as Gtk.ListView, "{ArrowDown}{Enter}");
        expect(activated).toEqual([0, 1]);
    });
});
