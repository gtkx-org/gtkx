import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, userEvent, waitFor, within } from "@gtkx/testing";
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

const findInnerText = (widget: Gtk.Widget): Gtk.Text | null => {
    if (widget instanceof Gtk.Text) return widget;
    for (let child = widget.getFirstChild(); child; child = child.getNextSibling()) {
        const found = findInnerText(child);
        if (found) return found;
    }
    return null;
};

const findPeekImage = (widget: Gtk.Widget): Gtk.Image | null => {
    if (widget instanceof Gtk.Image && widget.getIconName() === "view-reveal-symbolic") return widget;
    for (let child = widget.getFirstChild(); child; child = child.getNextSibling()) {
        const found = findPeekImage(child);
        if (found) return found;
    }
    return null;
};

const gestureOf = (widget: Gtk.Widget): Gtk.GestureClick | null => {
    const controllers = widget.observeControllers();
    for (let i = 0; i < controllers.getNItems(); i++) {
        const controller = controllers.getItem(i);
        if (controller instanceof Gtk.GestureClick) return controller;
    }
    return null;
};

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
        await findPasswordFields();
        const button = await findDoneButton();
        expect(button.getSensitive()).toBe(false);
    });

    it("reveals and re-hides the entered password when the peek icon is clicked", async () => {
        await renderDemo(passwordEntryDemo);
        const { password } = await findPasswordFields();
        await userEvent.type(password, "s3cret");

        const innerText = findInnerText(password);
        const peek = findPeekImage(password);
        expect(innerText).not.toBeNull();
        expect(peek).not.toBeNull();
        const gesture = gestureOf(peek as Gtk.Image);
        expect(gesture).not.toBeNull();

        expect((innerText as Gtk.Text).getVisibility()).toBe(false);
        await fireEvent(gesture as Gtk.GestureClick, "pressed", 1, 0, 0);
        await fireEvent(gesture as Gtk.GestureClick, "released", 1, 0, 0);
        expect((innerText as Gtk.Text).getVisibility()).toBe(true);
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
    it("packs the Done button into the header bar without showing title buttons", async () => {
        await renderDemo(passwordEntryDemo);
        const header = (await screen.findByName("password-entry-header")) as Gtk.HeaderBar;
        expect(header.getShowTitleButtons()).toBe(false);
        const done = within(header).getByRole(Gtk.AccessibleRole.BUTTON, { name: "_Done" });
        expect(done).toBe(await findDoneButton());
    });
});
