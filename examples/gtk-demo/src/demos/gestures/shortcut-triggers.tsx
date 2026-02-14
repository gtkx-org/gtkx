import * as Gtk from "@gtkx/ffi/gtk";
import { GtkLabel, GtkListBox, GtkShortcutController, x } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./shortcut-triggers.tsx?raw";

const ShortcutTriggersDemo = () => {
    return (
        <GtkListBox marginTop={6} marginBottom={6} marginStart={6} marginEnd={6}>
            <GtkLabel label="Press Ctrl-G">
                <GtkShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
                    <x.Shortcut trigger="<Control>g" onActivate={() => console.log("activated Press Ctrl-G")} />
                </GtkShortcutController>
            </GtkLabel>
            <GtkLabel label="Press X">
                <GtkShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
                    <x.Shortcut trigger="x" onActivate={() => console.log("activated Press X")} />
                </GtkShortcutController>
            </GtkLabel>
        </GtkListBox>
    );
};

export const shortcutTriggersDemo: Demo = {
    id: "shortcut-triggers",
    title: "Shortcuts",
    description:
        "GtkShortcut is the abstraction used by GTK to handle shortcuts from keyboard or other input devices. Shortcut triggers can be used to weave complex sequences of key presses into sophisticated mechanisms to activate shortcuts.",
    keywords: ["shortcut", "trigger", "keyboard", "accelerator", "GtkShortcutController", "keybinding"],
    component: ShortcutTriggersDemo,
    sourceCode,
    defaultWidth: 200,
};
