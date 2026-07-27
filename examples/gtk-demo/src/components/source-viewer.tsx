import * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
import { GtkBox, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { GtkSourceBuffer, GtkSourceView } from "@gtkx/jsx/gtksource";
import { useDemo } from "../context/demo-context.js";

const SourceViewer = () => {
    const { currentDemo } = useDemo();

    const handleRef = (view: GtkSource.View | null) => {
        if (!(view && currentDemo?.sourceCode)) {
            return;
        }

        const buffer = view.getBuffer();
        buffer.setText(currentDemo.sourceCode, -1);
    };

    return (
        <GtkScrolledWindow vexpand hexpand>
            {currentDemo?.sourceCode
                ? (
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
                            buffer={(
                                <GtkSourceBuffer
                                    language={GtkSource.LanguageManager.getDefault().getLanguage("typescript-jsx")}
                                    styleScheme={GtkSource.StyleSchemeManager.getDefault().getScheme("Adwaita-dark")}
                                />
                            )}
                        />
                    )
                : (
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            valign={Gtk.Align.CENTER}
                            halign={Gtk.Align.CENTER}
                            vexpand
                        >
                            <GtkLabel cssClasses={["dim-label"]}>No source</GtkLabel>
                        </GtkBox>
                    )}
        </GtkScrolledWindow>
    );
};

export { SourceViewer };
