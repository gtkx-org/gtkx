import * as Gdk from "@gtkx/gi/gdk";
import { GtkBox, GtkEventControllerKey } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

describe("Unicode keyboard input", () => {
    it.each(["a", "é", "λ", "🚀", "Aλ🚀Z"])("delivers each character of %s once", async (input) => {
        const pressed: number[] = [];
        const released: number[] = [];

        await render(
            <GtkBox
                name="keys"
                controllers={(
                    <GtkEventControllerKey
                        onKeyPressed={(keyval) => {
                            pressed.push(Gdk.keyvalToUnicode(keyval));

                            return Gdk.EVENT_STOP;
                        }}
                        onKeyReleased={(keyval) => {
                            released.push(Gdk.keyvalToUnicode(keyval));
                        }}
                    />
                )}
            />,
        );

        await userEvent.keyboard(screen.getByName("keys"), input);
        const expected = Array.from(input, (character) => character.codePointAt(0));
        expect(pressed).toEqual(expected);
        expect(released).toEqual(expected);
    });
});
