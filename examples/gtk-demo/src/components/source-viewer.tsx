import * as Adw from "@gtkx/gi/adw";
import * as GtkSource from "@gtkx/gi/gtksource";
import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { GtkSourceBuffer, GtkSourceView } from "@gtkx/jsx/gtksource";
import { useProperty } from "@gtkx/react";
import { useDemo } from "../context/demo-context.js";
import { EmptyState } from "./empty-state.js";

const SourceViewer = () => {
    const { currentDemo } = useDemo();
    const styleManager = Adw.StyleManager.getDefault();
    const isDark = useProperty(styleManager, "dark") ?? styleManager.getDark();
    const styleScheme = GtkSource.StyleSchemeManager.getDefault().getScheme(isDark ? "Adwaita-dark" : "Adwaita");

    return (
        <GtkScrolledWindow vexpand hexpand>
            {currentDemo?.sourceCode
                ? (
                        <GtkSourceView
                            accessibleLabel="Source code"
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
                                    text={currentDemo.sourceCode}
                                    language={GtkSource.LanguageManager.getDefault().getLanguage("typescript-jsx")}
                                    styleScheme={styleScheme}
                                />
                            )}
                        />
                    )
                : <EmptyState message="No source" />}
        </GtkScrolledWindow>
    );
};

export { SourceViewer };
