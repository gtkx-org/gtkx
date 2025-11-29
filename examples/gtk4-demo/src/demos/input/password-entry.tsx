import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, PasswordEntry } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

export const PasswordEntryDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Password Entry" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Secure Input" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="Password entry hides text by default and includes a toggle to reveal it."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <PasswordEntry placeholderText="Enter password..." showPeekIcon />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Without Peek Icon" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="You can disable the peek icon if you want strict password hiding."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <PasswordEntry placeholderText="Password (no peek)" />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Form Example" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <PasswordEntry placeholderText="Password (min 8 characters)" showPeekIcon />
                    <PasswordEntry placeholderText="Confirm password" showPeekIcon />
                </Box>
            </Box>
        </Box>
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
