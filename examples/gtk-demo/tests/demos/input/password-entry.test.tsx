import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { passwordEntryDemo } from "../../../src/demos/input/password-entry.js";
import { renderDemo } from "../../test-utils.js";

const findPasswordFields = async (): Promise<{ password: Gtk.PasswordEntry; confirm: Gtk.PasswordEntry }> => {
    const password = (await screen.findByName("password-entry")) as Gtk.PasswordEntry;
    const confirm = (await screen.findByName("confirm-entry")) as Gtk.PasswordEntry;
    return { password, confirm };
};

const findDoneButton = async (): Promise<Gtk.Button> =>
    (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Done" })) as Gtk.Button;

describe("passwordEntryDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(passwordEntryDemo.id).toBe("password-entry");
        expect(passwordEntryDemo.title).toBe("Entry/Password Entry");
        expect(passwordEntryDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(passwordEntryDemo.keywords)).toBe(true);
        expect(typeof passwordEntryDemo.sourceCode).toBe("string");
        expect(passwordEntryDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(passwordEntryDemo.component).toBeTypeOf("function");
    });
});

describe("passwordEntryDemo form behavior", () => {
    it("renders two password entries and a disabled Done button", async () => {
        await renderDemo(passwordEntryDemo);
        const { password, confirm } = await findPasswordFields();
        expect(password.getShowPeekIcon()).toBe(true);
        expect(confirm.getShowPeekIcon()).toBe(true);
        const button = await findDoneButton();
        expect(button.getSensitive()).toBe(false);
    });

    it("enables the Done button when both password fields match", async () => {
        await renderDemo(passwordEntryDemo);
        const { password, confirm } = await findPasswordFields();
        await userEvent.type(password, "hunter2");
        await userEvent.type(confirm, "hunter2");
        await waitFor(async () => {
            const button = await findDoneButton();
            expect(button.getSensitive()).toBe(true);
        });
    });

    it("keeps the Done button disabled when passwords differ", async () => {
        await renderDemo(passwordEntryDemo);
        const { password, confirm } = await findPasswordFields();
        await userEvent.type(password, "hunter2");
        await userEvent.type(confirm, "different");
        await waitFor(async () => {
            const button = await findDoneButton();
            expect(button.getSensitive()).toBe(false);
        });
    });

    it("invokes onClose when the Done button is activated with matching passwords", async () => {
        const onClose = vi.fn();
        await renderDemo(passwordEntryDemo, { onClose });
        const { password, confirm } = await findPasswordFields();
        await userEvent.type(password, "abc");
        await userEvent.type(confirm, "abc");
        const button = await waitFor(async () => {
            const candidate = await findDoneButton();
            expect(candidate.getSensitive()).toBe(true);
            return candidate;
        });
        await userEvent.click(button);
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });
});

describe("passwordEntryDemo window setup", () => {
    it("packs the header bar without showing title buttons and disables the window", async () => {
        await renderDemo(passwordEntryDemo);
        const header = (await screen.findByName("password-entry-header")) as Gtk.HeaderBar;
        expect(header).toBeInstanceOf(Gtk.HeaderBar);
        expect(header.getShowTitleButtons()).toBe(false);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        expect(window.getDeletable()).toBe(false);
    });
});
