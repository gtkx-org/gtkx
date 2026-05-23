import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it, vi } from "vitest";
import { passwordEntryDemo } from "../../../src/demos/input/password-entry.js";
import { act, fireEvent, renderDemo, screen, waitFor } from "../../test-utils.js";

const findPasswordEntries = async (): Promise<[Gtk.PasswordEntry, Gtk.PasswordEntry]> => {
    const all = await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX);
    const entries = all.filter((w): w is Gtk.PasswordEntry => w instanceof Gtk.PasswordEntry);
    if (entries.length < 2) throw new Error(`expected two password entries, got ${entries.length}`);
    return [entries[0] as Gtk.PasswordEntry, entries[1] as Gtk.PasswordEntry];
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
        const [pwd, confirm] = await findPasswordEntries();
        expect(pwd.getShowPeekIcon()).toBe(true);
        expect(confirm.getShowPeekIcon()).toBe(true);
        const button = await findDoneButton();
        expect(button.getSensitive()).toBe(false);
    });

    it("enables the Done button when both password fields match", async () => {
        await renderDemo(passwordEntryDemo);
        const [pwd, confirm] = await findPasswordEntries();
        await act(() => pwd.setText("hunter2"));
        await act(() => confirm.setText("hunter2"));
        await waitFor(async () => {
            const button = await findDoneButton();
            expect(button.getSensitive()).toBe(true);
        });
    });

    it("keeps the Done button disabled when passwords differ", async () => {
        await renderDemo(passwordEntryDemo);
        const [pwd, confirm] = await findPasswordEntries();
        await act(() => pwd.setText("hunter2"));
        await act(() => confirm.setText("different"));
        await waitFor(async () => {
            const button = await findDoneButton();
            expect(button.getSensitive()).toBe(false);
        });
    });

    it("invokes onClose when the Done button is activated with matching passwords", async () => {
        const onClose = vi.fn();
        await renderDemo(passwordEntryDemo, { onClose });
        const [pwd, confirm] = await findPasswordEntries();
        await act(() => pwd.setText("abc"));
        await act(() => confirm.setText("abc"));
        const button = await waitFor(async () => {
            const candidate = await findDoneButton();
            expect(candidate.getSensitive()).toBe(true);
            return candidate;
        });
        await fireEvent(button, "clicked");
        expect(onClose).toHaveBeenCalled();
    });
});

describe("passwordEntryDemo window setup", () => {
    it("packs the header bar without showing title buttons and disables the window", async () => {
        const { window } = await renderDemo(passwordEntryDemo);
        const win = window.current;
        if (!win) throw new Error("expected window ref to be populated");
        const titlebar = win.getTitlebar();
        expect(titlebar).toBeInstanceOf(Gtk.HeaderBar);
        expect((titlebar as Gtk.HeaderBar).getShowTitleButtons()).toBe(false);
        expect(win.getDeletable()).toBe(false);
    });
});
