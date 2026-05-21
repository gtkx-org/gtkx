import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { dialogDemo } from "../../../src/demos/dialogs/dialog.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

const findButtonByLabel = async (label: string): Promise<Gtk.Button> =>
    (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label })) as Gtk.Button;

const findAlertDialogs = (): Adw.AlertDialog[] => {
    const out: Adw.AlertDialog[] = [];
    for (const top of Gtk.Window.listToplevels()) {
        out.push(...findAllOfType(top, Adw.AlertDialog));
    }
    return out;
};

describe("dialogDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(dialogDemo, { id: "dialog", title: "Dialogs" });
        expect(typeof dialogDemo.sourceCode).toBe("string");
        expect(dialogDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(dialogDemo.keywords).toContain("dialog");
        expect(dialogDemo.keywords).toContain("AdwAlertDialog");
        expect(dialogDemo.component).toBeTypeOf("function");
    });

    it("renders the Message Dialog button, the Interactive Dialog button and two entries", async () => {
        await renderDemo(dialogDemo);
        const messageButton = await findButtonByLabel("_Message Dialog");
        expect(messageButton).toBeInstanceOf(Gtk.Button);
        const interactiveButton = await findButtonByLabel("_Interactive Dialog");
        expect(interactiveButton).toBeInstanceOf(Gtk.Button);
        const entries = await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX);
        expect(entries.length).toBeGreaterThanOrEqual(2);
        expect(entries[0]).toBeInstanceOf(Gtk.Entry);
    });
});

describe("dialogDemo message dialog", () => {
    it("presents an AdwAlertDialog with heading 'Test message' and body 'Has been shown once' after the first click", async () => {
        await renderDemo(dialogDemo);
        const messageButton = await findButtonByLabel("_Message Dialog");
        await fireEvent(messageButton, "clicked");
        const dialog = await waitFor(() => {
            const [d] = findAlertDialogs();
            if (!d) throw new Error("alert dialog not yet presented");
            return d;
        });
        expect(dialog.getHeading()).toBe("Test message");
        expect(dialog.getBody()).toBe("Has been shown once");
    });

    it("increments the body text to 'Has been shown 2 times' after a second clicked signal", async () => {
        await renderDemo(dialogDemo);
        const messageButton = await findButtonByLabel("_Message Dialog");
        await fireEvent(messageButton, "clicked");
        await waitFor(() => {
            const [d] = findAlertDialogs();
            if (!d) throw new Error("first dialog not yet presented");
            if (d.getBody() !== "Has been shown once") throw new Error("body not yet once");
        });
        await fireEvent(messageButton, "clicked");
        const dialog = await waitFor(
            () => {
                const [d] = findAlertDialogs();
                if (!d) throw new Error("alert dialog not presented");
                if (d.getBody() !== "Has been shown 2 times") {
                    throw new Error(`body is "${d.getBody()}" not yet 2 times`);
                }
                return d;
            },
            { timeout: 3000 },
        );
        expect(dialog.getBody()).toBe("Has been shown 2 times");
    });

    it("dismisses the message dialog after emitting the response signal", async () => {
        await renderDemo(dialogDemo);
        const messageButton = await findButtonByLabel("_Message Dialog");
        await fireEvent(messageButton, "clicked");
        const dialog = await waitFor(() => {
            const [d] = findAlertDialogs();
            if (!d) throw new Error("alert dialog not yet presented");
            return d;
        });
        await fireEvent(dialog, "response", "ok");
        await waitFor(() => {
            if (findAlertDialogs().length > 0) throw new Error("dialog still presented");
        });
        expect(findAlertDialogs().length).toBe(0);
    });
});

describe("dialogDemo interactive dialog", () => {
    it("updates the demo entry text from the typed value", async () => {
        await renderDemo(dialogDemo);
        const entries = (await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry[];
        const firstEntry = entries[0];
        if (!firstEntry) throw new Error("expected at least one entry");
        await act(() => firstEntry.setText("hello"));
        await fireEvent(firstEntry, "changed");
        expect(firstEntry.getText()).toBe("hello");
    });

    it("renders the interactive dialog with two entry fields when opened", async () => {
        await renderDemo(dialogDemo);
        const interactiveButton = await findButtonByLabel("_Interactive Dialog");
        await fireEvent(interactiveButton, "clicked");
        const interactive = await waitFor(() => {
            const dialogs = findAlertDialogs();
            const d = dialogs[dialogs.length - 1];
            if (!d) throw new Error("interactive dialog not yet presented");
            return d;
        });
        expect(interactive.getHeading()).toBe("Interactive Dialog");
        const dialogEntries = findAllOfType(interactive, Gtk.Entry);
        expect(dialogEntries.length).toBe(2);
    });

    it("closes the interactive dialog when its response signal fires with 'cancel'", async () => {
        await renderDemo(dialogDemo);
        const interactiveButton = await findButtonByLabel("_Interactive Dialog");
        await fireEvent(interactiveButton, "clicked");
        const interactive = await waitFor(() => {
            const dialogs = findAlertDialogs();
            const d = dialogs[dialogs.length - 1];
            if (!d) throw new Error("interactive dialog not yet presented");
            return d;
        });
        await fireEvent(interactive, "response", "cancel");
        await waitFor(() => {
            if (findAlertDialogs().length > 0) throw new Error("dialog still presented");
        });
        const demoEntries = (await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry[];
        expect(demoEntries[0]?.getText()).toBe("");
        expect(demoEntries[1]?.getText()).toBe("");
    });
});
