import { EntryRow, FormProvider, SwitchRow, useForm } from "@gtkx/forms";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { t } from "@gtkx/i18n";
import { AdwActionRow, AdwClamp, AdwPreferencesGroup } from "@gtkx/jsx/adw";
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
import { useEffect } from "react";
import type { Task } from "../types.js";
import { formatDateTime, formatDue } from "../format.js";
import { useStore } from "../store/index.js";
import { detailNotes } from "../styles.js";

type TaskFields = Pick<Task, "important" | "title">;

const localDateTime = (iso: string | null): GLib.DateTime | null | undefined => {
    if (iso === null) {
        return undefined;
    }
    const milliseconds = new Date(iso).getTime();
    const seconds = BigInt(Math.floor(milliseconds / 1000));

    return GLib.DateTime.newFromUnixLocal(seconds);
};

const dueFrom = (date: GLib.DateTime): string =>
    new Date(date.getYear(), date.getMonth() - 1, date.getDayOfMonth(), 18, 0, 0).toISOString();

const DuePicker = ({ task }: { task: Task }) => {
    const updateTask = useStore((state) => state.updateTask);
    const dueDate = localDateTime(task.due);

    return (
        <AdwActionRow
            title={t("Due")}
            suffix={(
                <GtkBox spacing={6} valign={Gtk.Align.CENTER}>
                    {task.due
                        ? (
                                <GtkButton
                                    iconName="edit-clear-symbolic"
                                    cssClasses={["flat", "circular"]}
                                    accessibleLabel={t("Clear due date")}
                                    onClicked={() => {
                                        updateTask(task.id, { due: null });
                                    }}
                                />
                            )
                        : null}
                    <GtkMenuButton
                        label={formatDue(task.due) ?? t("Set date")}
                        popover={(
                            <GtkPopover>
                                <GtkCalendar
                                    date={dueDate}
                                    onDaySelected={(self) => {
                                        updateTask(task.id, { due: dueFrom(self.getDate()) });
                                    }}
                                />
                            </GtkPopover>
                        )}
                    />
                </GtkBox>
            )}
        />
    );
};

const TaskForm = ({ task }: { task: Task }) => {
    const updateTask = useStore((state) => state.updateTask);
    const setImportant = useStore((state) => state.setImportant);
    const form = useForm<TaskFields>({
        defaultValues: { important: task.important, title: task.title },
    });
    const { resetField } = form;

    useEffect(() => {
        resetField("important", { defaultValue: task.important });
    }, [resetField, task.important]);

    const saveTitle = form.handleSubmit(({ title }) => {
        const normalized = title.trim();
        updateTask(task.id, { title: normalized });
        resetField("title", { defaultValue: normalized });
    });
    const submitTitle = (): void => {
        void saveTitle();
    };

    return (
        <FormProvider {...form}>
            <AdwPreferencesGroup>
                <EntryRow<TaskFields>
                    name="title"
                    title={t("Title")}
                    showApplyButton
                    rules={{ validate: (title) => title.trim().length > 0 }}
                    onApply={submitTitle}
                    onEntryActivated={submitTitle}
                />
                <SwitchRow<TaskFields>
                    name="important"
                    title={t("Important")}
                    onNotifyActive={(active) => {
                        setImportant(task.id, active ?? false);
                    }}
                />
                <DuePicker task={task} />
            </AdwPreferencesGroup>
        </FormProvider>
    );
};

const TaskNotes = ({ task }: { task: Task }) => {
    const updateTask = useStore((state) => state.updateTask);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
            <GtkLabel halign={Gtk.Align.START} cssClasses={["heading"]}>
                {t("Notes")}
            </GtkLabel>
            <GtkScrolledWindow cssClasses={["card"]} heightRequest={160}>
                <GtkTextView
                    wrapMode={Gtk.WrapMode.WORD_CHAR}
                    cssClasses={[detailNotes]}
                    buffer={(
                        <GtkTextBuffer
                            enableUndo
                            text={task.notes}
                            onChanged={(buffer) => {
                                const notes = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
                                updateTask(task.id, { notes });
                            }}
                        />
                    )}
                />
            </GtkScrolledWindow>
        </GtkBox>
    );
};

const TaskMetadata = ({ task }: { task: Task }) => (
    <AdwPreferencesGroup>
        <AdwActionRow
            cssClasses={["property"]}
            title={t("Created")}
            subtitle={formatDateTime(task.createdAt)}
        />
        {task.completedAt
            ? (
                    <AdwActionRow
                        cssClasses={["property"]}
                        title={t("Completed")}
                        subtitle={formatDateTime(task.completedAt)}
                    />
                )
            : null}
    </AdwPreferencesGroup>
);

const TaskDetail = ({ task }: { task: Task }) => (
    <GtkScrolledWindow vexpand>
        <AdwClamp maximumSize={600} marginTop={24} marginBottom={24} marginStart={12} marginEnd={12}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={18}>
                <TaskForm task={task} />
                <TaskNotes task={task} />
                <TaskMetadata task={task} />
            </GtkBox>
        </AdwClamp>
    </GtkScrolledWindow>
);

export {
    TaskDetail,
};
