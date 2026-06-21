import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { dialogDemo } from "../../../src/demos/dialogs/dialog.js";
import { renderDemo } from "../../test-utils.js";

const openDialog = async (buttonName: string, dialogName: string): Promise<Adw.AlertDialog> => {
    const button = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: buttonName })) as Gtk.Button;
    await userEvent.click(button);
    return (await screen.findByName(dialogName)) as Adw.AlertDialog;
};

const openMessageDialog = (): Promise<Adw.AlertDialog> => openDialog("_Message Dialog", "message-dialog");

const openInteractiveDialog = (): Promise<Adw.AlertDialog> => openDialog("_Interactive Dialog", "interactive-dialog");

describe("dialogDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(dialogDemo.id).toBe("dialog");
        expect(dialogDemo.title).toBe("Dialogs");
        expect(dialogDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(dialogDemo.keywords)).toBe(true);
        expect(typeof dialogDemo.sourceCode).toBe("string");
        expect(dialogDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(dialogDemo.component).toBeTypeOf("function");
    });

    it("renders the Message Dialog button, the Interactive Dialog button and two entries", async () => {
        await renderDemo(dialogDemo);
        const messageButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Message Dialog" });
        expect(messageButton).toBeInstanceOf(Gtk.Button);
        const interactiveButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Interactive Dialog" });
        expect(interactiveButton).toBeInstanceOf(Gtk.Button);
        expect(await screen.findByName("demo-entry-1")).toBeInstanceOf(Gtk.Entry);
        expect(await screen.findByName("demo-entry-2")).toBeInstanceOf(Gtk.Entry);
    });
});

describe("dialogDemo message dialog", () => {
    it("presents an AdwAlertDialog with heading 'Test message' and body 'Has been shown once' after the first click", async () => {
        await renderDemo(dialogDemo);
        const dialog = await openMessageDialog();
        expect(dialog.getHeading()).toBe("Test message");
        expect(dialog.getBody()).toBe("Has been shown once");
    });

    it("increments the body text to 'Has been shown 2 times' after a second clicked signal", async () => {
        await renderDemo(dialogDemo);
        const messageButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "_Message Dialog",
        })) as Gtk.Button;
        await userEvent.click(messageButton);
        const firstDialog = (await screen.findByName("message-dialog")) as Adw.AlertDialog;
        await waitFor(() => expect(firstDialog.getBody()).toBe("Has been shown once"));
        await userEvent.click(messageButton);
        await waitFor(() => {
            const dialog = screen.queryByName("message-dialog") as Adw.AlertDialog | null;
            expect(dialog).not.toBeNull();
            expect(dialog?.getBody()).toBe("Has been shown 2 times");
        });
    });

    it("dismisses the message dialog after emitting the response signal", async () => {
        await renderDemo(dialogDemo);
        const dialog = await openMessageDialog();
        await fireEvent(dialog, "response", "ok");
        await waitFor(() => expect(screen.queryByName("message-dialog")).toBeNull());
    });
});

describe("dialogDemo interactive dialog", () => {
    it("updates the demo entry text from the typed value", async () => {
        await renderDemo(dialogDemo);
        const firstEntry = (await screen.findByName("demo-entry-1")) as Gtk.Entry;
        await userEvent.type(firstEntry, "hello");
        expect(firstEntry.getText()).toBe("hello");
    });

    it("renders the interactive dialog with two entry fields when opened", async () => {
        await renderDemo(dialogDemo);
        const interactive = await openInteractiveDialog();
        expect(interactive.getHeading()).toBe("Interactive Dialog");
        expect(await screen.findByName("dialog-entry-1")).toBeInstanceOf(Gtk.Entry);
        expect(await screen.findByName("dialog-entry-2")).toBeInstanceOf(Gtk.Entry);
    });

    it("closes the interactive dialog when its response signal fires with 'cancel'", async () => {
        await renderDemo(dialogDemo);
        const interactive = await openInteractiveDialog();
        await fireEvent(interactive, "response", "cancel");
        await waitFor(() => expect(screen.queryByName("interactive-dialog")).toBeNull());
        const demoEntry1 = (await screen.findByName("demo-entry-1")) as Gtk.Entry;
        const demoEntry2 = (await screen.findByName("demo-entry-2")) as Gtk.Entry;
        expect(demoEntry1.getText()).toBe("");
        expect(demoEntry2.getText()).toBe("");
    });

    it("commits the dialog entries to the demo entries when responding with 'ok'", async () => {
        await renderDemo(dialogDemo);
        const interactive = await openInteractiveDialog();
        const dialogEntry1 = (await screen.findByName("dialog-entry-1")) as Gtk.Entry;
        const dialogEntry2 = (await screen.findByName("dialog-entry-2")) as Gtk.Entry;
        await userEvent.type(dialogEntry1, "alpha");
        await userEvent.type(dialogEntry2, "beta");
        await fireEvent(interactive, "response", "ok");
        await waitFor(() => expect(screen.queryByName("interactive-dialog")).toBeNull());
        const demoEntry1 = (await screen.findByName("demo-entry-1")) as Gtk.Entry;
        const demoEntry2 = (await screen.findByName("demo-entry-2")) as Gtk.Entry;
        expect(demoEntry1.getText()).toBe("alpha");
        expect(demoEntry2.getText()).toBe("beta");
    });
});
