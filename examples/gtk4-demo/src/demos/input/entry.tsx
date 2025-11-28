import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Entry, Label } from "@gtkx/react";
import type { Demo } from "../types.js";

export const EntryDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Entry" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Basic Entry" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="Entry is a single-line text input widget. Type in the entries below."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <Entry placeholderText="Type something..." />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Max Length (10 characters)" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Entry placeholderText="Max 10 chars" maxLength={10} />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Entry Purposes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="Input purpose helps mobile keyboards show appropriate layouts."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <Entry placeholderText="Free form text" inputPurpose={Gtk.InputPurpose.FREE_FORM} />
                <Entry placeholderText="Email address" inputPurpose={Gtk.InputPurpose.EMAIL} />
                <Entry placeholderText="Phone number" inputPurpose={Gtk.InputPurpose.PHONE} />
                <Entry placeholderText="URL" inputPurpose={Gtk.InputPurpose.URL} />
                <Entry placeholderText="Number" inputPurpose={Gtk.InputPurpose.NUMBER} />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Disabled Entry" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Entry text="Cannot edit this" sensitive={false} />
            </Box>
        </Box>
    );
};

export const entryDemo: Demo = {
    id: "entry",
    title: "Entry",
    description: "Single-line text input widget.",
    keywords: ["entry", "input", "text", "field", "GtkEntry"],
    component: EntryDemo,
    source: `const EntryDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <Entry placeholderText="Type something..." />
            <Entry placeholderText="Max 10 chars" maxLength={10} />
            <Entry placeholderText="Email" inputPurpose={Gtk.InputPurpose.EMAIL} />
            <Entry text="Disabled" sensitive={false} />
        </Box>
    );
};`,
};
