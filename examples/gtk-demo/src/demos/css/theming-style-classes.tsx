import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkGrid, x } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./theming-style-classes.tsx?raw";

const ThemingStyleClassesDemo = () => {
    return (
        <GtkGrid
            rowSpacing={10}
            marginStart={10}
            marginEnd={10}
            marginTop={10}
            marginBottom={10}
            orientation={Gtk.Orientation.VERTICAL}
        >
            <x.GridChild column={0} row={0}>
                <GtkBox cssClasses={["linked"]} valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER}>
                    <GtkButton label="Hi, I am a button" receivesDefault />
                    <GtkButton label="And I'm another button" receivesDefault />
                    <GtkButton label="This is a button party!" receivesDefault />
                </GtkBox>
            </x.GridChild>
            <x.GridChild column={0} row={1}>
                <GtkBox spacing={10}>
                    <GtkButton label="Plain" halign={Gtk.Align.END} hexpand vexpand />
                    <GtkButton label="Destructive" cssClasses={["destructive-action"]} />
                    <GtkButton label="Suggested" cssClasses={["suggested-action"]} />
                </GtkBox>
            </x.GridChild>
        </GtkGrid>
    );
};

export const themingStyleClassesDemo: Demo = {
    id: "theming-style-classes",
    title: "Theming/Style Classes",
    description:
        "GTK uses CSS for theming. Style classes can be associated with widgets to inform the theme about intended rendering.",
    keywords: ["css", "classes", "theming", "linked", "destructive", "suggested"],
    component: ThemingStyleClassesDemo,
    sourceCode,
};
