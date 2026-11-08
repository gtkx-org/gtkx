import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
import { useTranslation } from "@gtkx/i18n";
import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { GtkSourceBuffer, GtkSourceView } from "@gtkx/jsx/gtksource";
import { useProperty } from "@gtkx/react";
import { useEffect, useRef, useState } from "react";
import { NoteLinkProvider } from "./note-link-provider.js";

const markdown = GtkSource.LanguageManager.getDefault().getLanguage("markdown");

const useLinkCompletion = (view: GtkSource.View | null, linkTargets: readonly string[]): void => {
    const latestTargets = useRef(linkTargets);

    useEffect(() => {
        latestTargets.current = linkTargets;
    }, [linkTargets]);

    useEffect(() => {
        if (view === null) {
            return;
        }
        const provider = new NoteLinkProvider();
        provider.noteNames = () => latestTargets.current;
        const completion = view.getCompletion();
        completion.selectOnShow = true;
        completion.addProvider(provider);

        return () => completion.removeProvider(provider);
    }, [view]);
};

type NoteEditorProps = { text: string; linkTargets: readonly string[]; onChange: (text: string) => void };

const NoteEditor = ({ text, linkTargets, onChange }: NoteEditorProps) => {
    const { t } = useTranslation();
    const isDark = useProperty(Adw.StyleManager.getDefault(), "dark");
    const styleScheme = GtkSource.StyleSchemeManager.getDefault().getScheme(isDark ? "Adwaita-dark" : "Adwaita");
    const [view, setView] = useState<GtkSource.View | null>(null);
    useLinkCompletion(view, linkTargets);

    return (
        <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
            <GtkSourceView
                ref={setView}
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
                            onChange(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false));
                        }}
                    />
                }
            />
        </GtkScrolledWindow>
    );
};

export { NoteEditor };
