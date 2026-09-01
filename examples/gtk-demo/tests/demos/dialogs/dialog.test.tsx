import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { dialogDemo } from "../../../src/demos/dialogs/dialog.js";
import { renderDemo } from "../../test-utils.js";

const openDialog = async (buttonName: string, dialogName: string): Promise<Adw.AlertDialog> => {
    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: buttonName, as: Gtk.Button });
    await userEvent.click(button);

    return screen.findByName(dialogName, { as: Adw.AlertDialog });
};

const openMessageDialog = (): Promise<Adw.AlertDialog> => openDialog("Message Dialog", "message-dialog");
const openInteractiveDialog = (): Promise<Adw.AlertDialog> => openDialog("Interactive Dialog", "interactive-dialog");

const expectDialogClosed = async (dialogName: string): Promise<void> => {
    await waitFor(() => {
        expect(screen.queryByName(dialogName)).toBeNull();
    });
};

const clickMessageDialogResponse = async (response: RegExp): Promise<void> => {
    const dialog = await openMessageDialog();
    await userEvent.click(within(dialog).getByRole(Gtk.AccessibleRole.BUTTON, { name: response }));
};

describe("dialogDemo metadata", () => {
    it("renders the Message Dialog button, the Interactive Dialog button and two empty entries", async () => {
        await renderDemo(dialogDemo);
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Message Dialog" });
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Interactive Dialog" });
        expect(await screen.findByName("demo-entry-1")).toHaveDisplayValue("");
        expect(await screen.findByName("demo-entry-2")).toHaveDisplayValue("");
    });
});

describe("dialogDemo message dialog", () => {
    it(
        "presents an AdwAlertDialog with heading 'Test message' and body 'Has been shown once' after the first click",
        async () => {
            await renderDemo(dialogDemo);
            const dialog = await openMessageDialog();
            expect(dialog).toHaveAccessibleName("Test message");
            await within(dialog).findByText("Has been shown once");
        },
    );

    it("increments the body text to 'Has been shown 2 times' after a second clicked signal", async () => {
        await renderDemo(dialogDemo);

        const messageButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Message Dialog",
            as: Gtk.Button,
        });

        await userEvent.click(messageButton);
        const firstDialog = await screen.findByName("message-dialog", { as: Adw.AlertDialog });
        await within(firstDialog).findByText("Has been shown once");
        await userEvent.click(within(firstDialog).getByRole(Gtk.AccessibleRole.BUTTON, { name: /OK/ }));
        await expectDialogClosed("message-dialog");
        await userEvent.click(messageButton);
        const secondDialog = await screen.findByName("message-dialog", { as: Adw.AlertDialog });
        await within(secondDialog).findByText("Has been shown 2 times");
    });

    it("dismisses the message dialog after emitting the response signal", async () => {
        await renderDemo(dialogDemo);
        await clickMessageDialogResponse(/OK/);
        await expectDialogClosed("message-dialog");
    });

    it("dismisses the message dialog via the Cancel/closeResponse button", async () => {
        await renderDemo(dialogDemo);
        await clickMessageDialogResponse(/Cancel/);
        await expectDialogClosed("message-dialog");
    });
});

describe("dialogDemo interactive dialog", () => {
    it("updates the demo entry text from the typed value", async () => {
        await renderDemo(dialogDemo);
        const firstEntry = await screen.findByName("demo-entry-1", { as: Gtk.Entry });
        await userEvent.type(firstEntry, "hello");
        expect(screen.getByDisplayValue("hello")).toBe(firstEntry);
    });

    it("updates the second demo entry text from the typed value", async () => {
        await renderDemo(dialogDemo);
        const secondEntry = await screen.findByName("demo-entry-2", { as: Gtk.Entry });
        await userEvent.type(secondEntry, "world");
        expect(secondEntry).toHaveDisplayValue("world");
    });
});

describe("dialogDemo interactive dialog entries", () => {
    it("renders the interactive dialog with two empty entry fields when opened unseeded", async () => {
        await renderDemo(dialogDemo);
        const interactive = await openInteractiveDialog();
        expect(interactive).toHaveAccessibleName("Interactive Dialog");
        expect(await screen.findByName("dialog-entry-1")).toHaveDisplayValue("");
        expect(await screen.findByName("dialog-entry-2")).toHaveDisplayValue("");
    });

    it("seeds the interactive dialog entries from the current demo entry values", async () => {
        await renderDemo(dialogDemo);
        await userEvent.type((await screen.findByName("demo-entry-1")), "seed1");
        await userEvent.type((await screen.findByName("demo-entry-2")), "seed2");
        await openInteractiveDialog();
        expect(await screen.findByName("dialog-entry-1")).toHaveDisplayValue("seed1");
        expect(await screen.findByName("dialog-entry-2")).toHaveDisplayValue("seed2");
    });

    it("discards dialog edits and keeps the prior demo values when responding with 'cancel'", async () => {
        await renderDemo(dialogDemo);
        await userEvent.type((await screen.findByName("demo-entry-1")), "orig");
        const interactive = await openInteractiveDialog();
        const dialogEntry1 = await screen.findByName("dialog-entry-1", { as: Gtk.Entry });
        expect(dialogEntry1).toHaveDisplayValue("orig");
        await userEvent.type(dialogEntry1, "-edited", { initialSelectionStart: "orig".length });
        expect(dialogEntry1).toHaveDisplayValue("orig-edited");
        await userEvent.click(within(interactive).getByRole(Gtk.AccessibleRole.BUTTON, { name: /Cancel/ }));
        await expectDialogClosed("interactive-dialog");
        expect(await screen.findByName("demo-entry-1", { as: Gtk.Entry })).toHaveDisplayValue("orig");
    });

    it("commits the dialog entries to the demo entries when responding with 'ok'", async () => {
        await renderDemo(dialogDemo);
        const interactive = await openInteractiveDialog();
        const dialogEntry1 = await screen.findByName("dialog-entry-1", { as: Gtk.Entry });
        const dialogEntry2 = await screen.findByName("dialog-entry-2", { as: Gtk.Entry });
        await userEvent.type(dialogEntry1, "alpha");
        await userEvent.type(dialogEntry2, "beta");
        await userEvent.click(within(interactive).getByRole(Gtk.AccessibleRole.BUTTON, { name: /OK/ }));
        await expectDialogClosed("interactive-dialog");
        const demoEntry1 = await screen.findByName("demo-entry-1", { as: Gtk.Entry });
        const demoEntry2 = await screen.findByName("demo-entry-2", { as: Gtk.Entry });
        expect(screen.getByDisplayValue("alpha")).toBe(demoEntry1);
        expect(screen.getByDisplayValue("beta")).toBe(demoEntry2);
    });
});
