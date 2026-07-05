import { AnimatePresence, animated } from "@gtkx/animate";
import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import type { Note } from "../types.js";

const baseCard = css`
    background: @card_bg_color;
    border-radius: 12px;
    box-shadow:
        0 1px 4px alpha(black, 0.15),
        0 0 0 1px alpha(black, 0.08);

    &:hover {
        box-shadow:
            0 2px 8px alpha(black, 0.2),
            0 0 0 1px alpha(black, 0.1);
    }
`;

type NoteCardProps = {
    note: Note;
    compact?: boolean | undefined;
    fontSize?: number | undefined;
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
            <animated.GtkBox
                key={note.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
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
            </animated.GtkBox>
        </AnimatePresence>
    );
};
