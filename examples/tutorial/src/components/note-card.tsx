import { css } from "@gtkx/css";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwTimedAnimation, AnimatePresence } from "@gtkx/react";
import { GtkBox, GtkLabel } from "@gtkx/react-gi/gtk";
import type { Note } from "../types.js";

const baseCard = css`
    background: alpha(@card_bg_color, 0.8);
    border-radius: 12px;

    &:hover {
        background: @card_bg_color;
    }
`;

type NoteCardProps = {
    note: Note;
    compact?: boolean;
    fontSize?: number;
};

export const NoteCard = ({ note, compact = false, fontSize = 14 }: NoteCardProps) => {
    const cardStyle = css`
        padding: ${compact ? 8 : 16}px;
    `;

    const titleStyle = css`
        font-weight: bold;
        font-size: ${fontSize}px;
    `;

    const previewStyle = css`
        color: alpha(@window_fg_color, 0.6);
        font-size: ${fontSize - 2}px;
    `;

    const dateStyle = css`
        color: alpha(@window_fg_color, 0.4);
        font-size: ${fontSize - 3}px;
    `;

    return (
        <AnimatePresence>
            <AdwTimedAnimation
                key={note.id}
                initial={{ opacity: 0, translateY: -10 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateX: -50 }}
                duration={200}
                easing={Adw.Easing.EASE_OUT_CUBIC}
                animateOnMount
            >
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={compact ? 2 : 4}
                    cssClasses={[baseCard, cardStyle]}
                >
                    <GtkLabel label={note.title} halign={Gtk.Align.START} cssClasses={[titleStyle]} />
                    <GtkLabel
                        label={note.body || "Empty note"}
                        halign={Gtk.Align.START}
                        cssClasses={[previewStyle]}
                        ellipsize={2}
                        lines={compact ? 1 : 2}
                    />
                    {!compact && (
                        <GtkLabel
                            label={note.createdAt.toLocaleDateString()}
                            halign={Gtk.Align.START}
                            cssClasses={[dateStyle]}
                        />
                    )}
                </GtkBox>
            </AdwTimedAnimation>
        </AnimatePresence>
    );
};
