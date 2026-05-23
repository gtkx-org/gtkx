import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkGrid } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./theming-style-classes.tsx?raw";

const ThemingStyleClassesDemo = () => (
    <GtkGrid
        name="root-grid"
        rowSpacing={10}
        marginStart={10}
        marginEnd={10}
        marginTop={10}
        marginBottom={10}
        orientation={Gtk.Orientation.VERTICAL}
    >
        <GtkGrid.Child column={0} row={0}>
            <GtkBox cssClasses={["linked"]} valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER}>
                <GtkButton label="Hi, I am a button" receivesDefault />
                <GtkButton label="And I'm another button" receivesDefault />
                <GtkButton label="This is a button party!" receivesDefault />
            </GtkBox>
        </GtkGrid.Child>
        <GtkGrid.Child column={0} row={1}>
            <GtkBox spacing={10}>
                <GtkButton label="Plain" halign={Gtk.Align.END} hexpand />
                <GtkButton label="Destructive" cssClasses={["destructive-action"]} />
                <GtkButton label="Suggested" cssClasses={["suggested-action"]} />
            </GtkBox>
        </GtkGrid.Child>
    </GtkGrid>
);

export const themingStyleClassesDemo: Demo = {
    id: "theming-style-classes",
    title: "Theming/Style Classes",
    description:
        "GTK uses CSS for theming. Style classes can be associated with widgets to inform the theme about intended rendering.\n\nThis demo shows some common examples where theming features of GTK are used for certain effects: primary toolbars and linked buttons.",
    keywords: [],
    component: ThemingStyleClassesDemo,
    sourceCode,
    resizable: false,
};
