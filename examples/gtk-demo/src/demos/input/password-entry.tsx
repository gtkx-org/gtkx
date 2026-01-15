import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkPasswordEntry } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./password-entry.tsx?raw";

const PasswordEntryDemo = () => {
    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={6}
            marginStart={18}
            marginEnd={18}
            marginTop={18}
            marginBottom={18}
        >
            <GtkPasswordEntry showPeekIcon placeholderText="Password" activatesDefault />
            <GtkPasswordEntry showPeekIcon placeholderText="Confirm" activatesDefault />
        </GtkBox>
    );
};

export const passwordEntryDemo: Demo = {
    id: "password-entry",
    title: "Entry/Password Entry",
    description:
        "GtkPasswordEntry provides common functionality of entries that are used to enter passwords and other secrets. It will display a warning if CapsLock is on, and it can optionally provide a way to see the text.",
    keywords: ["password", "entry", "secure", "GtkPasswordEntry", "peek"],
    component: PasswordEntryDemo,
    sourceCode,
};
