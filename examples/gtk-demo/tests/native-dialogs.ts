import * as Gtk from "@gtkx/gi/gtk";
import { act, waitFor } from "@gtkx/testing";
import { assert, expect } from "vitest";

const findAddedWindow = async (previous: ReadonlySet<Gtk.Widget>): Promise<Gtk.Window> => {
    return await waitFor(() => {
        const added = Gtk.Window.listToplevels().filter((widget) => !previous.has(widget) && widget.getMapped());
        expect(added).toHaveLength(1);
        const [window] = added;
        assert(window instanceof Gtk.Window);

        return window;
    });
};

const expectInspectorOpened = async (activate: () => Promise<void>): Promise<void> => {
    const previous = new Set(Gtk.Window.listToplevels().filter((widget) => widget.getMapped()));

    try {
        await activate();
        expect(await findAddedWindow(previous)).toBeVisible();
    } finally {
        await act(() => {
            Gtk.Window.setInteractiveDebugging(false);
        });
        await waitFor(() => {
            const added = Gtk.Window.listToplevels().filter((widget) => !previous.has(widget) && widget.getMapped());
            expect(added).toHaveLength(0);
        });
    }
};

export { expectInspectorOpened, findAddedWindow };
