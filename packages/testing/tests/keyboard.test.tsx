import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkCheckButton,
    GtkEntry,
    GtkEventControllerKey,
    GtkLabel,
    GtkShortcut,
    GtkShortcutController,
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
