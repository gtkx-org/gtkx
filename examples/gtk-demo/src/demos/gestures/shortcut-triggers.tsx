import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkListBox, GtkShortcut, GtkShortcutController } from "@gtkx/jsx/gtk";
import type { Demo } from "../types.js";
import sourceCode from "./shortcut-triggers.tsx?raw";

const shortcutTriggersDemo: Demo = {
    id: "shortcut-triggers",
    title: "Shortcuts",
    description:
        "GtkShortcut is the abstraction used by GTK to handle shortcuts from keyboard or other input " +
        "devices.\n\nShortcut triggers can be used to weave complex sequences of key presses into " +
        "sophisticated mechanisms to activate shortcuts.\n\nThis demo code shows creative ways to do that.",
    keywords: ["GtkShortcutController"],
    component: ShortcutTriggersDemo,
    sourceCode,
    defaultWidth: 200,
    resizable: false,
};

const logAction = (message: string): Gtk.ShortcutAction =>
    Gtk.CallbackAction.new(() => {
        console.log(message);

        return true;
    });

function ShortcutTriggersDemo() {
    return (
        <GtkListBox name="list-box" marginTop={6} marginBottom={6} marginStart={6} marginEnd={6}>
            <GtkLabel
                name="label-ctrl-g"
                controllers={(
                    <GtkShortcutController
                        scope={Gtk.ShortcutScope.GLOBAL}
                        shortcuts={(
                            <GtkShortcut
                                trigger={Gtk.ShortcutTrigger.parseString("<Control>g")}
                                action={logAction("activated Press Ctrl-G")}
                            />
                        )}
                    />
                )}
            >
                Press Ctrl-G
            </GtkLabel>
            <GtkLabel
                name="label-x"
                controllers={(
                    <GtkShortcutController
                        scope={Gtk.ShortcutScope.GLOBAL}
                        shortcuts={(
                            <GtkShortcut
                                trigger={Gtk.ShortcutTrigger.parseString("x")}
                                action={logAction("activated Press X")}
                            />
                        )}
                    />
                )}
            >
                Press X
            </GtkLabel>
        </GtkListBox>
    );
}

export { shortcutTriggersDemo };
