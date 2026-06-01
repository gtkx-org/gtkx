import * as Gtk from "@gtkx/gi/gtk";
import type * as GtkSource from "@gtkx/gi/gtksource";
import { GtkBox, GtkLabel, GtkScrolledWindow, GtkSourceView } from "@gtkx/react";
import { useCallback } from "react";
import { useDemo } from "../context/demo-context.js";

export const SourceViewer = () => {
    const { currentDemo } = useDemo();

    const handleRef = useCallback(
        (view: GtkSource.View | null) => {
            if (view && currentDemo?.sourceCode) {
                const buffer = view.getBuffer();
                buffer.setText(currentDemo.sourceCode, -1);
            }
        },
        [currentDemo?.sourceCode],
    );

    return (
        <GtkScrolledWindow vexpand hexpand>
            {currentDemo?.sourceCode ? (
                <GtkSourceView
                    name="source-view"
                    ref={handleRef}
                    editable={false}
                    showLineNumbers
                    tabWidth={4}
                    leftMargin={20}
                    rightMargin={20}
                    topMargin={20}
                    bottomMargin={20}
                    monospace
                    language="typescript-jsx"
                    styleScheme="Adwaita-dark"
                />
            ) : (
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    valign={Gtk.Align.CENTER}
                    halign={Gtk.Align.CENTER}
                    vexpand
                >
                    <GtkLabel label="No source" cssClasses={["dim-label"]} />
                </GtkBox>
            )}
        </GtkScrolledWindow>
    );
};
