import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkPasswordEntry } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const PasswordEntryDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Password Entry" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Secure Input" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Password entry hides text by default and includes a toggle to reveal it."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkPasswordEntry placeholderText="Enter password..." showPeekIcon />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Without Peek Icon" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="You can disable the peek icon if you want strict password hiding."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkPasswordEntry placeholderText="Password (no peek)" />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Form Example" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkPasswordEntry placeholderText="Password (min 8 characters)" showPeekIcon />
                    <GtkPasswordEntry placeholderText="Confirm password" showPeekIcon />
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const passwordEntryDemo: Demo = {
    id: "password-entry",
    title: "Password Entry",
    description: "Secure password input with visibility toggle.",
    keywords: ["password", "entry", "secure", "input", "GtkPasswordEntry"],
    component: PasswordEntryDemo,
    sourcePath: getSourcePath(import.meta.url, "password-entry.tsx"),
};
