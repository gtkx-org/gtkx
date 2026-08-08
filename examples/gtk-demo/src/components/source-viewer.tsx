import * as GtkSource from "@gtkx/gi/gtksource";
import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { GtkSourceBuffer, GtkSourceView } from "@gtkx/jsx/gtksource";
import { useDemo } from "../context/demo-context.js";
import { EmptyState } from "./empty-state.js";

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
                : <EmptyState message="No source" />}
        </GtkScrolledWindow>
    );
};

export { SourceViewer };
