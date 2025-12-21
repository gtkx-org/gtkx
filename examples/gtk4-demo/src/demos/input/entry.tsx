import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkEntry, GtkLabel } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const EntryDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Entry" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Basic Entry" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkEntry is a single-line text input widget. Type in the entries below."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkEntry placeholderText="Type something..." />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Max Length (10 characters)" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkEntry placeholderText="Max 10 chars" maxLength={10} />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="GtkEntry Purposes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Input purpose helps mobile keyboards show appropriate layouts."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkEntry placeholderText="Free form text" inputPurpose={Gtk.InputPurpose.FREE_FORM} />
                <GtkEntry placeholderText="Email address" inputPurpose={Gtk.InputPurpose.EMAIL} />
                <GtkEntry placeholderText="Phone number" inputPurpose={Gtk.InputPurpose.PHONE} />
                <GtkEntry placeholderText="URL" inputPurpose={Gtk.InputPurpose.URL} />
                <GtkEntry placeholderText="Number" inputPurpose={Gtk.InputPurpose.NUMBER} />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Disabled Entry" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkEntry text="Cannot edit this" sensitive={false} />
            </GtkBox>
        </GtkBox>
    );
};

export const entryDemo: Demo = {
    id: "entry",
    title: "Entry",
    description: "Single-line text input widget.",
    keywords: ["entry", "input", "text", "field", "GtkEntry"],
    component: EntryDemo,
    sourcePath: getSourcePath(import.meta.url, "entry.tsx"),
};
