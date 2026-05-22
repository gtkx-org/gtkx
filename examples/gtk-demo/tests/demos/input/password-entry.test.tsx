import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { passwordEntryDemo } from "../../../src/demos/input/password-entry.js";
import { renderDemo } from "../../helpers/render-demo.js";

const findAllByType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new () => T): T[] => {
    const results: T[] = [];
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node instanceof ctor) results.push(node as T);
        let next = node.getFirstChild();
        while (next) {
            stack.push(next);
            next = next.getNextSibling();
        }
    }
    return results;
};

const findDoneButton = (root: Gtk.Widget): Gtk.Button | null => {
    const buttons = findAllByType(root, Gtk.Button);
    return buttons.find((b) => b.getCssClasses().includes("suggested-action")) ?? null;
};

describe("passwordEntryDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(passwordEntryDemo.id).toBe("password-entry");
        expect(passwordEntryDemo.title).toBe("Entry/Password Entry");
        expect(typeof passwordEntryDemo.sourceCode).toBe("string");
        expect(passwordEntryDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(passwordEntryDemo.component).toBeTypeOf("function");
    });
});

describe("passwordEntryDemo form behavior", () => {
    it("renders two password entries and a disabled Done button", async () => {
        const { container } = await renderDemo(passwordEntryDemo);
        const passwordEntries = findAllByType(container, Gtk.PasswordEntry);
        expect(passwordEntries).toHaveLength(2);
        for (const entry of passwordEntries) {
            expect(entry.getShowPeekIcon()).toBe(true);
        }
        const button = findDoneButton(container);
        expect(button).toBeInstanceOf(Gtk.Button);
        expect(button?.getSensitive()).toBe(false);
    });

    it("enables the Done button when both password fields match", async () => {
        const { container } = await renderDemo(passwordEntryDemo);
        const [pwd, confirm] = findAllByType(container, Gtk.PasswordEntry);
        if (!pwd || !confirm) throw new Error("expected two password entries");
        await act(() => pwd.setText("hunter2"));
        await act(() => confirm.setText("hunter2"));
        await waitFor(() => {
            const button = findDoneButton(container);
            expect(button?.getSensitive()).toBe(true);
        });
    });

    it("keeps the Done button disabled when passwords differ", async () => {
        const { container } = await renderDemo(passwordEntryDemo);
        const [pwd, confirm] = findAllByType(container, Gtk.PasswordEntry);
        if (!pwd || !confirm) throw new Error("expected two password entries");
        await act(() => pwd.setText("hunter2"));
        await act(() => confirm.setText("different"));
        await waitFor(() => {
            const button = findDoneButton(container);
            expect(button).not.toBeNull();
            expect(button?.getSensitive()).toBe(false);
        });
    });

    it("invokes onClose when the Done button is activated with matching passwords", async () => {
        const onClose = vi.fn();
        const { container } = await renderDemo(passwordEntryDemo, { onClose });
        const [pwd, confirm] = findAllByType(container, Gtk.PasswordEntry);
        if (!pwd || !confirm) throw new Error("expected two password entries");
        await act(() => pwd.setText("abc"));
        await act(() => confirm.setText("abc"));
        const button = await waitFor(() => {
            const candidate = findDoneButton(container);
            expect(candidate?.getSensitive()).toBe(true);
            return candidate as Gtk.Button;
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
