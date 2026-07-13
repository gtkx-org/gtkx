import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow, AdwClamp, AdwEntryRow, AdwPreferencesGroup, AdwSwitchRow } from "@gtkx/jsx/adw";
import {
    GtkBox,
    GtkButton,
    GtkCalendar,
    GtkLabel,
    GtkMenuButton,
    GtkPopover,
    GtkScrolledWindow,
    GtkTextBuffer,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { formatDateTime, formatDue } from "../format.js";
import { detailNotes } from "../styles.js";
import type { Task } from "../types.js";

type TaskDetailProps = {
    task: Task;
    onUpdate: (fields: Partial<Pick<Task, "title" | "notes" | "due">>) => void;
    onSetImportant: (important: boolean) => void;
};

export const TaskDetail = ({ task, onUpdate, onSetImportant }: TaskDetailProps) => {
    const dueDate = task.due ? GLib.DateTime.newFromIso8601(task.due, null) : undefined;

    return (
        <GtkScrolledWindow vexpand>
            <AdwClamp maximumSize={600} marginTop={24} marginBottom={24} marginStart={12} marginEnd={12}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={18}>
                    <AdwPreferencesGroup>
                        <AdwEntryRow
                            title="Title"
                            text={task.title}
                            showApplyButton
                            onApply={(self) => onUpdate({ title: self.text })}
                            onEntryActivated={(self) => onUpdate({ title: self.text })}
                        />
                        <AdwSwitchRow
                            title="Important"
                            active={task.important}
                            onNotifyActive={(active) => onSetImportant(active ?? false)}
                        />
                        <AdwActionRow
                            title="Due"
                            suffix={
                                <GtkBox spacing={6} valign={Gtk.Align.CENTER}>
                                    {task.due ? (
                                        <GtkButton
                                            iconName="edit-clear-symbolic"
                                            cssClasses={["flat", "circular"]}
                                            accessibleLabel="Clear due date"
                                            onClicked={() => onUpdate({ due: null })}
                                        />
                                    ) : null}
                                    <GtkMenuButton
                                        label={formatDue(task.due) ?? "Set date"}
                                        popover={
                                            <GtkPopover>
                                                <GtkCalendar
                                                    date={dueDate}
                                                    onDaySelected={(self) => {
                                                        const date = self.getDate();
                                                        const picked = new Date(
                                                            date.getYear(),
                                                            date.getMonth() - 1,
                                                            date.getDayOfMonth(),
                                                            18,
                                                            0,
                                                            0,
                                                        );
                                                        onUpdate({ due: picked.toISOString() });
                                                    }}
                                                />
                                            </GtkPopover>
                                        }
                                    />
                                </GtkBox>
                            }
                        />
                    </AdwPreferencesGroup>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkLabel label="Notes" halign={Gtk.Align.START} cssClasses={["heading"]} />
                        <GtkScrolledWindow cssClasses={["card"]} heightRequest={160}>
                            <GtkTextView
                                wrapMode={Gtk.WrapMode.WORD_CHAR}
                                cssClasses={[detailNotes]}
                                buffer={
                                    <GtkTextBuffer
                                        enableUndo
                                        onChanged={(buffer) =>
                                            onUpdate({
                                                notes: buffer.getText(
                                                    buffer.getStartIter(),
                                                    buffer.getEndIter(),
                                                    false,
                                                ),
                                            })
                                        }
                                    >
                                        {task.notes}
                                    </GtkTextBuffer>
                                }
                            />
                        </GtkScrolledWindow>
                    </GtkBox>

                    <AdwPreferencesGroup>
                        <AdwActionRow
                            cssClasses={["property"]}
                            title="Created"
                            subtitle={formatDateTime(task.createdAt)}
                        />
                        {task.completedAt ? (
                            <AdwActionRow
                                cssClasses={["property"]}
                                title="Completed"
                                subtitle={formatDateTime(task.completedAt)}
                            />
                        ) : null}
                    </AdwPreferencesGroup>
                </GtkBox>
            </AdwClamp>
        </GtkScrolledWindow>
    );
};
