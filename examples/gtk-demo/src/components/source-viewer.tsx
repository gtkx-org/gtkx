import * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import { GtkBox, GtkLabel, GtkScrolledWindow, GtkSourceView } from "@gtkx/react";
import { useEffect, useMemo } from "react";
import { useDemo } from "../context/demo-context.js";

export const SourceViewer = () => {
    const { currentDemo } = useDemo();

    const buffer = useMemo(() => {
        const buf = new GtkSource.Buffer();
        const langManager = GtkSource.LanguageManager.getDefault();
        const language = langManager.guessLanguage("example.tsx");

        if (language) {
            buf.setLanguage(language);
        }

        const schemeManager = GtkSource.StyleSchemeManager.getDefault();
        const scheme = schemeManager.getScheme("Adwaita-dark");

        if (scheme) {
            buf.setStyleScheme(scheme);
        }

        buf.setHighlightSyntax(true);

        return buf;
    }, []);

    useEffect(() => {
        if (currentDemo?.sourceCode) {
            buffer.setText(currentDemo.sourceCode, -1);
        } else {
            buffer.setText("", 0);
        }
    }, [buffer, currentDemo?.sourceCode]);

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
                    buffer={buffer}
                    editable={false}
                    showLineNumbers
                    tabWidth={4}
                    leftMargin={12}
                    rightMargin={12}
                    topMargin={12}
                    bottomMargin={12}
                    monospace
                />
            </GtkScrolledWindow>
        </GtkBox>
    );
};
