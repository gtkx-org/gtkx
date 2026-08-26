import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { t } from "@gtkx/i18n";
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
import { useStore } from "../store/index.js";
import { detailNotes } from "../styles.js";
import type { Task } from "../types.js";

export const TaskDetail = ({ task }: { task: Task }) => {
    const updateTask = useStore((state) => state.updateTask);
    const setImportant = useStore((state) => state.setImportant);
    const dueDate = task.due ? GLib.DateTime.newFromIso8601(task.due, null) : undefined;

    return (
        <GtkScrolledWindow vexpand>
            <AdwClamp maximumSize={600} marginTop={24} marginBottom={24} marginStart={12} marginEnd={12}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={18}>
                    <AdwPreferencesGroup>
                        <AdwEntryRow
                            title={t("Title")}
                            text={task.title}
                            showApplyButton
                            onApply={(self) => updateTask(task.id, { title: self.text })}
                            onEntryActivated={(self) => updateTask(task.id, { title: self.text })}
                        />
                        <AdwSwitchRow
                            title={t("Important")}
                            active={task.important}
                            onNotifyActive={(active) => setImportant(task.id, active ?? false)}
                        />
                        <AdwActionRow
                            title={t("Due")}
                            suffix={
                                <GtkBox spacing={6} valign={Gtk.Align.CENTER}>
                                    {task.due ? (
                                        <GtkButton
                                            iconName="edit-clear-symbolic"
                                            cssClasses={["flat", "circular"]}
                                            accessibleLabel={t("Clear due date")}
                                            onClicked={() => updateTask(task.id, { due: null })}
                                        />
                                    ) : null}
                                    <GtkMenuButton
                                        label={formatDue(task.due) ?? t("Set date")}
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
                                                        updateTask(task.id, { due: picked.toISOString() });
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
                        <GtkLabel halign={Gtk.Align.START} cssClasses={["heading"]}>
                            {t("Notes")}
                        </GtkLabel>
                        <GtkScrolledWindow cssClasses={["card"]} heightRequest={160}>
                            <GtkTextView
                                wrapMode={Gtk.WrapMode.WORD_CHAR}
                                cssClasses={[detailNotes]}
                                buffer={
                                    <GtkTextBuffer
                                        enableUndo
                                        text={task.notes}
                                        onChanged={(buffer) =>
                                            updateTask(task.id, {
                                                notes: buffer.getText(
                                                    buffer.getStartIter(),
                                                    buffer.getEndIter(),
                                                    false,
                                                ),
                                            })
                                        }
                                    />
                                }
                            />
                        </GtkScrolledWindow>
                    </GtkBox>

                    <AdwPreferencesGroup>
                        <AdwActionRow
                            cssClasses={["property"]}
                            title={t("Created")}
                            subtitle={formatDateTime(task.createdAt)}
                        />
                        {task.completedAt ? (
                            <AdwActionRow
                                cssClasses={["property"]}
                                title={t("Completed")}
                                subtitle={formatDateTime(task.completedAt)}
                            />
                        ) : null}
                    </AdwPreferencesGroup>
                </GtkBox>
            </AdwClamp>
        </GtkScrolledWindow>
    );
};
