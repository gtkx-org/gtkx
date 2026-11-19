import * as Gtk from "@gtkx/gi/gtk";
import { createRoot } from "@gtkx/react";
import { userEvent, within } from "@gtkx/testing";
import { setTimeout as delay } from "node:timers/promises";
import { App } from "../tutorial/fast-refresh/src/app.js";

const findWindow = async (): Promise<Gtk.Widget> => {
    for (;;) {
        const [window] = Gtk.Window.listToplevels();

        if (window !== undefined) {
            return window;
        }

        await delay(50);
    }
};

createRoot().render(<App />);

const app = within(await findWindow());

await userEvent.click(
    await app.findByRole(Gtk.AccessibleRole.LIST_ITEM, {
        name: "Meeting notes",
    }),
);
await userEvent.click(
    await app.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
        name: "Preview",
    }),
);
const preview = within(await app.findByRole(Gtk.AccessibleRole.DOCUMENT, { name: "Preview" }));
await preview.findByText("Launch when the content is ready, not before.");
console.log("clip-ready");
