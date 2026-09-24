import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkCallbackAction,
    GtkLabel,
    GtkListBox,
    GtkShortcut,
    GtkShortcutController,
    GtkShortcutTrigger,
} from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./shortcut-triggers.tsx?raw";

const shortcutTriggersDemo: Demo = {
    id: "shortcut-triggers",
    title: "Shortcuts",
    description: "This demo maps keyboard shortcut triggers to actions.",
    keywords: ["GtkShortcutController"],
    component: ShortcutTriggersDemo,
    sourceCode,
    defaultWidth: 200,
    isResizable: false,
};

type ShortcutLabelProps = {
    name: string;
    accelerator: string;
    children: string;
    onActivate: () => boolean;
};

const ShortcutLabel = ({ name, accelerator, children, onActivate }: ShortcutLabelProps) => (
    <GtkLabel
        name={name}
        controllers={(
            <GtkShortcutController
                scope={Gtk.ShortcutScope.GLOBAL}
                shortcuts={(
                    <GtkShortcut
                        trigger={<GtkShortcutTrigger accelerator={accelerator} />}
                        action={<GtkCallbackAction callback={onActivate} />}
                    />
                )}
            />
        )}
    >
        {children}
    </GtkLabel>
);

function ShortcutTriggersDemo() {
    const [status, setStatus] = useState("No shortcut activated");
    const activate = (message: string) => (): boolean => {
        setStatus(message);

        return true;
    };

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={6}
            marginTop={6}
            marginBottom={6}
            marginStart={6}
            marginEnd={6}
        >
            <GtkListBox name="list-box" selectionMode={Gtk.SelectionMode.NONE}>
                <ShortcutLabel
                    name="label-ctrl-g"
                    accelerator="<Control>g"
                    onActivate={activate("Ctrl-G activated")}
                >
                    Press Ctrl-G
                </ShortcutLabel>
                <ShortcutLabel name="label-x" accelerator="x" onActivate={activate("X activated")}>
                    Press X
                </ShortcutLabel>
            </GtkListBox>
            <GtkLabel name="shortcut-status" accessibleRole={Gtk.AccessibleRole.STATUS}>
                {status}
            </GtkLabel>
        </GtkBox>
    );
}

export { shortcutTriggersDemo };
