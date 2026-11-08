import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
import { useTranslation } from "@gtkx/i18n";
import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { GtkSourceBuffer, GtkSourceView } from "@gtkx/jsx/gtksource";
import { useProperty } from "@gtkx/react";

const markdown = GtkSource.LanguageManager.getDefault().getLanguage("markdown");

type NoteEditorProps = { text: string; onChange: (text: string) => void };

const NoteEditor = ({ text, onChange }: NoteEditorProps) => {
    const { t } = useTranslation();
    const isDark = useProperty(Adw.StyleManager.getDefault(), "dark");
    const styleScheme = GtkSource.StyleSchemeManager.getDefault().getScheme(
        isDark ? "Adwaita-dark" : "Adwaita",
    );

    return (
        <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
            <GtkSourceView
                accessibleLabel={t("Note text")}
                wrapMode={Gtk.WrapMode.WORD_CHAR}
                topMargin={18}
                bottomMargin={18}
                leftMargin={18}
                rightMargin={18}
                buffer={
                    <GtkSourceBuffer
                        text={text}
                        language={markdown}
                        styleScheme={styleScheme}
                        onChanged={(buffer) => {
                            onChange(
                                buffer.getText(
                                    buffer.getStartIter(),
                                    buffer.getEndIter(),
                                    false,
                                ),
                            );
                        }}
                    />
                }
            />
        </GtkScrolledWindow>
    );
};

export { NoteEditor };
