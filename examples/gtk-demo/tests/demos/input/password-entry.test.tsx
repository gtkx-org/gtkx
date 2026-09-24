import * as Gtk from "@gtkx/gi/gtk";
import { screen, screenshot, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { passwordEntryDemo } from "../../../src/demos/input/password-entry.js";
import { renderDemo, type RenderDemoOptions } from "../../test-utils.js";

const findPasswordFields = async (): Promise<{ password: Gtk.PasswordEntry; confirm: Gtk.PasswordEntry }> => {
    const password = await screen.findByName("password-entry", { as: Gtk.PasswordEntry });
    const confirm = await screen.findByName("confirm-entry", { as: Gtk.PasswordEntry });

    return { password, confirm };
};

const findDoneButton = async (): Promise<Gtk.Button> =>
    screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Done", as: Gtk.Button });

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
        const peek = within(password).getByRole(Gtk.AccessibleRole.IMG, { as: Gtk.Image });

        const hidden = await screenshot(password);
        await userEvent.pointer(peek, "click");
        const revealed = await screenshot(password);
        expect(revealed.data).not.toBe(hidden.data);
        await userEvent.pointer(peek, "click");
        const hiddenAgain = await screenshot(password);
        expect(hiddenAgain.data).not.toBe(revealed.data);
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
        let closeCount = 0;
        await typePasswords("abc", "abc", {
            onClose: () => {
                closeCount += 1;
            },
        });

        const button = await waitFor(async () => {
            const candidate = await findDoneButton();
            expect(candidate).toBeEnabled();

            return candidate;
        });

        await userEvent.click(button);

        await waitFor(() => {
            expect(closeCount).toBe(1);
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
