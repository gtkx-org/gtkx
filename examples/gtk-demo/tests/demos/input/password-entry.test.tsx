import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, queryController, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { passwordEntryDemo } from "../../../src/demos/input/password-entry.js";
import { findWidget, renderDemo, type RenderDemoOptions } from "../../test-utils.js";

const findPasswordFields = async (): Promise<{ password: Gtk.PasswordEntry; confirm: Gtk.PasswordEntry }> => {
    const password = await screen.findByName("password-entry", { as: Gtk.PasswordEntry });
    const confirm = await screen.findByName("confirm-entry", { as: Gtk.PasswordEntry });

    return { password, confirm };
};

const findDoneButton = async (): Promise<Gtk.Button> =>
    screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Done", as: Gtk.Button });

const isPeekImage = (widget: Gtk.Image): boolean => widget.getIconName() === "view-reveal-symbolic";

const typePasswords = async (
    password: string,
    confirmation: string,
    options: RenderDemoOptions = {},
): Promise<void> => {
    await renderDemo(passwordEntryDemo, options);
    const fields = await findPasswordFields();
    await userEvent.type(fields.password, password);
    await userEvent.type(fields.confirm, confirmation);
};

describe("passwordEntryDemo form behavior", () => {
    it("renders two password entries and a disabled Done button", async () => {
        await renderDemo(passwordEntryDemo);
        await findPasswordFields();
        const button = await findDoneButton();
        expect(button).toBeDisabled();
    });

    it("reveals and re-hides the entered password when the peek icon is clicked", async () => {
        await renderDemo(passwordEntryDemo);
        const { password } = await findPasswordFields();
        await userEvent.type(password, "s3cret");
        const innerText = findWidget(password, Gtk.Text);
        const peek = findWidget(password, Gtk.Image, isPeekImage);
        expect(innerText).not.toBeNull();
        expect(peek).not.toBeNull();
        const gesture = queryController(peek as Gtk.Image, Gtk.GestureClick);
        expect(gesture).not.toBeNull();
        expect(innerText as Gtk.Text).toHaveObjectProperty("visibility", false);
        await fireEvent(gesture as Gtk.GestureClick, "pressed", 1, 0, 0);
        await fireEvent(gesture as Gtk.GestureClick, "released", 1, 0, 0);
        expect(innerText as Gtk.Text).toHaveObjectProperty("visibility", true);
    });
});

describe("passwordEntryDemo done button", () => {
    it("enables the Done button when both password fields match", async () => {
        await typePasswords("hunter2", "hunter2");

        await waitFor(async () => {
            const button = await findDoneButton();
            expect(button).toBeEnabled();
        });
    });

    it("keeps the Done button disabled when passwords differ", async () => {
        await typePasswords("hunter2", "different");

        await waitFor(async () => {
            const button = await findDoneButton();
            expect(button).toBeDisabled();
        });
    });

    it("invokes onClose when the Done button is activated with matching passwords", async () => {
        const onClose = vi.fn();
        await typePasswords("abc", "abc", { onClose });

        const button = await waitFor(async () => {
            const candidate = await findDoneButton();
            expect(candidate).toBeEnabled();

            return candidate;
        });

        await userEvent.click(button);

        await waitFor(() => {
            expect(onClose).toHaveBeenCalled();
        });
    });
});

describe("passwordEntryDemo window setup", () => {
    it("packs the Done button into the header bar without showing title buttons", async () => {
        await renderDemo(passwordEntryDemo);
        const header = await screen.findByName("password-entry-header", { as: Gtk.HeaderBar });
        expect(header).toHaveObjectProperty("showTitleButtons", false);
        const done = within(header).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Done" });
        expect(done).toBe(await findDoneButton());
    });
});
