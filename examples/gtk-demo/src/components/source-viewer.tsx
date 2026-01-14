import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkScrolledWindow, GtkSourceView, x } from "@gtkx/react";
import { useDemo } from "../context/demo-context.js";

export const SourceViewer = () => {
    const { currentDemo } = useDemo();

    if (!currentDemo) {
        return (
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                valign={Gtk.Align.CENTER}
                halign={Gtk.Align.CENTER}
                vexpand
                hexpand
            >
                <GtkLabel label="No source" cssClasses={["dim-label"]} />
            </GtkBox>
        );
    }

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand hexpand>
            <GtkScrolledWindow vexpand hexpand>
                <GtkSourceView
                    editable={false}
                    showLineNumbers
                    tabWidth={4}
                    leftMargin={12}
                    rightMargin={12}
                    topMargin={12}
                    bottomMargin={12}
                    monospace
                >
                    <x.SourceBuffer
                        text={currentDemo.sourceCode ?? ""}
                        language="typescript"
                        styleScheme="Adwaita-dark"
                    />
                </GtkSourceView>
            </GtkScrolledWindow>
        </GtkBox>
    );
};
