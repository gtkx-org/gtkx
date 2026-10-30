import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwDialog } from "@gtkx/jsx/adw";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkEntry,
    GtkEventControllerKey,
    GtkLabel,
    GtkMenuButton,
    GtkPopover,
    GtkShortcut,
    GtkShortcutController,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

describe("Unicode keyboard input", () => {
    it.each(["a", "é", "λ", "🚀", "Aλ🚀Z"])("delivers each character of %s once", async (input) => {
        const pressed: number[] = [];
        const released: number[] = [];

        await render(
            <GtkBox
                name="keys"
                controllers={
                    <GtkEventControllerKey
                        onKeyPressed={(keyval) => {
                            pressed.push(Gdk.keyvalToUnicode(keyval));

                            return Gdk.EVENT_STOP;
                        }}
                        onKeyReleased={(keyval) => {
                            released.push(Gdk.keyvalToUnicode(keyval));
                        }}
                    />
                }
            />,
        );

        await userEvent.keyboard(screen.getByName("keys"), input);
        const expected = Array.from(input, (character) => character.codePointAt(0));
        expect(pressed).toEqual(expected);
        expect(released).toEqual(expected);
    });
});

describe("keyboard mnemonics", () => {
    it.each(["{Alt>}r{/Alt}", "{Alt>}R{/Alt}", "{Alt>}{Shift>}r{/Shift}{/Alt}"])(
        "activates a native label's parent with %s",
        async (input) => {
            await render(
                <GtkBox>
                    <GtkEntry name="source" />
                    <GtkCheckButton name="remember">
                        <GtkLabel label="_Remember" useUnderline />
                    </GtkCheckButton>
                </GtkBox>,
            );

            const source = screen.getByName("source");
            await userEvent.click(source);
            await userEvent.keyboard(source, input);
            expect(screen.getByName("remember")).toBeChecked();
        },
    );

    it.each(["r", "{Control>}r{/Control}", "{Alt>}{Control>}r{/Control}{/Alt}", "{Alt>}x{/Alt}"])(
        "ignores a mnemonic when its key or modifiers do not match: %s",
        async (input) => {
            await render(
                <GtkBox>
                    <GtkEntry name="source" />
                    <GtkCheckButton name="remember" label="_Remember" useUnderline />
                </GtkBox>,
            );

            await userEvent.keyboard(screen.getByName("source"), input);
            expect(screen.getByName("remember")).not.toBeChecked();
        },
    );

    it("ignores hidden and insensitive mnemonic targets", async () => {
        await render(
            <GtkBox>
                <GtkEntry name="source" />
                <GtkCheckButton name="remember" label="_Remember" useUnderline />
                <GtkCheckButton name="disabled" label="_Remember disabled" useUnderline sensitive={false} />
                <GtkCheckButton label="_Remember hidden" useUnderline visible={false} />
            </GtkBox>,
        );

        await userEvent.keyboard(screen.getByName("source"), "{Alt>}r{/Alt}");
        expect(screen.getByName("remember")).toBeChecked();
        expect(screen.getByName("disabled")).not.toBeChecked();
    });

    it("cycles focus between duplicate mnemonics without activating either target", async () => {
        await render(
            <GtkBox>
                <GtkEntry name="source" />
                <GtkCheckButton name="first" label="_Remember first" useUnderline />
                <GtkCheckButton name="second" label="_Remember second" useUnderline />
            </GtkBox>,
        );

        const source = screen.getByName("source");
        await userEvent.click(source);
        await userEvent.keyboard(source, "{Alt>}r{/Alt}");
        const first = screen.getByName("first");
        const second = screen.getByName("second");
        const focused = first.hasFocus() ? first : second;
        const next = focused === first ? second : first;
        expect(focused).toHaveFocus();

        await userEvent.keyboard(source, "{Alt>}r{/Alt}");
        expect(next).toHaveFocus();
        await userEvent.keyboard(source, "{Alt>}r{/Alt}");
        expect(focused).toHaveFocus();
        expect(first).not.toBeChecked();
        expect(second).not.toBeChecked();
    });

    it("uses a shortcut controller's configured mnemonic modifier", async () => {
        await render(
            <GtkCheckButton
                name="remember"
                label="Remember"
                controllers={
                    <GtkShortcutController
                        mnemonicModifiers={Gdk.ModifierType.CONTROL_MASK}
                        shortcuts={
                            <GtkShortcut
                                trigger={new Gtk.MnemonicTrigger({ keyval: Gdk.KEY_r })}
                                action={Gtk.MnemonicAction.get()}
                            />
                        }
                    />
                }
            />,
        );

        const target = screen.getByName("remember");
        await userEvent.keyboard(target, "{Alt>}r{/Alt}");
        expect(target).not.toBeChecked();
        await userEvent.keyboard(target, "{Control>}r{/Control}");
        expect(target).toBeChecked();
    });

    it("rejects an unknown key without leaving the mnemonic modifier held", async () => {
        await render(<GtkCheckButton name="remember" label="_Remember" useUnderline />);

        const user = userEvent.setup();
        const target = screen.getByName("remember");
        await expect(user.keyboard(target, "{Alt>}{Unknown}{/Alt}")).rejects.toThrow();
        await user.keyboard(target, "r");
        expect(target).not.toBeChecked();
    });
});

describe("keyboard focus movement", () => {
    it("moves focus with Tab, Shift+Tab and arrow keys as the window's bindings do", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkEntry name="name" />
                <GtkCheckButton name="subscribe" label="Subscribe" />
                <GtkButton name="submit" label="Submit" />
            </GtkBox>,
        );

        const name = screen.getByName("name");
        const subscribe = screen.getByName("subscribe");
        const submit = screen.getByName("submit");
        await userEvent.click(name);
        await userEvent.keyboard(name, "{Tab}");
        expect(subscribe).toHaveFocus();
        await userEvent.keyboard(subscribe, "{Tab}");
        expect(submit).toHaveFocus();
        await userEvent.keyboard(submit, "{Shift>}{Tab}{/Shift}");
        expect(subscribe).toHaveFocus();
        await userEvent.keyboard(subscribe, "{ArrowDown}");
        expect(submit).toHaveFocus();
        await userEvent.keyboard(submit, "{ArrowUp}");
        expect(subscribe).toHaveFocus();
    });

    it("follows focus through one key sequence on a common ancestor", async () => {
        await render(
            <GtkBox name="form" orientation={Gtk.Orientation.VERTICAL}>
                <GtkEntry name="first" />
                <GtkEntry name="second" />
                <GtkEntry name="third" />
            </GtkBox>,
        );

        await userEvent.click(screen.getByName("first"));
        await userEvent.keyboard(screen.getByName("form"), "{Tab}{Tab}");
        expect(screen.getByName("third")).toHaveFocus();
    });

    it("keeps a text view's Tab and Return as text instead of moving focus", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkTextView name="notes" />
                <GtkButton name="after" label="After" />
            </GtkBox>,
        );

        const notes = screen.getByName("notes", { as: Gtk.TextView });
        await userEvent.click(notes);
        await userEvent.keyboard(notes, "{Tab}{Enter}");
        const buffer = notes.getBuffer();
        expect(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), true)).toBe("\t\n");
        expect(notes).toHaveFocus();
    });
});

describe("keyboard in popovers", () => {
    it("closes an open popover with Escape before an enclosing dialog handles it", async () => {
        let closedDialogs = 0;

        await render(
            <AdwDialog
                title="Edit"
                onClosed={() => {
                    closedDialogs++;
                }}
            >
                <GtkMenuButton
                    label="Color"
                    popover={
                        <GtkPopover>
                            <GtkButton name="blue" label="Blue" />
                        </GtkPopover>
                    }
                />
            </AdwDialog>,
        );

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Color" }));
        const blue = await screen.findByName("blue");
        await userEvent.keyboard(blue, "{Escape}");
        expect(blue).not.toBeVisible();
        expect(screen.getByRole(Gtk.AccessibleRole.DIALOG, { name: "Edit" })).toBeVisible();
        expect(closedDialogs).toBe(0);
    });
});
