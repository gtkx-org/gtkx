import { markupEscapeText } from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkButton, GtkCheckButton, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useStore } from "../store/index.js";
import type { Task } from "../types.js";

export const TaskRow = ({ task }: { task: Task }) => {
    const setDone = useStore((state) => state.setDone);
    const setImportant = useStore((state) => state.setImportant);
    const moveToTrash = useStore((state) => state.moveToTrash);
    const escapedTitle = markupEscapeText(task.title, -1);
    const title = task.done ? `<s>${escapedTitle}</s>` : escapedTitle;

    return (
        <AdwActionRow
            title={title}
            useMarkup
            prefix={
                <GtkCheckButton
                    valign={Gtk.Align.CENTER}
                    active={task.done}
                    accessibleLabel="Mark complete"
                    onToggled={(self) => setDone(task.id, self.active)}
                />
            }
            suffix={
                <>
                    <GtkToggleButton
                        valign={Gtk.Align.CENTER}
                        iconName={
                            task.important
                                ? "starred-symbolic"
                                : "non-starred-symbolic"
                        }
                        active={task.important}
                        accessibleLabel="Toggle important"
                        cssClasses={["flat"]}
                        onToggled={(self) => setImportant(task.id, self.active)}
                    />
                    <GtkButton
                        valign={Gtk.Align.CENTER}
                        iconName="user-trash-symbolic"
                        accessibleLabel="Delete task"
                        cssClasses={["flat"]}
                        onClicked={() => moveToTrash(task.id)}
                    />
                </>
            }
        />
    );
};
