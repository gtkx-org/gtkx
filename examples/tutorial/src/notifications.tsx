import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { t } from "@gtkx/i18n";
import { GNotification } from "@gtkx/jsx/gio";
import { createPortal, rootElement, useApplication } from "@gtkx/react";
import { useEffect, useState } from "react";
import { formatDateTime } from "./format.js";
import { isCurrentReminder, isPendingReminder, type Reminder } from "./hooks/use-reminders.js";
import { useStore } from "./store/index.js";

const createReminderTarget = (id: string, due: string): GLib.Variant =>
    GLib.Variant.newTuple([GLib.Variant.newString(id), GLib.Variant.newString(due)]);

const readReminderTarget = (target: GLib.Variant): Reminder => ({
    id: target.getChildValue(0).getString()[0],
    due: target.getChildValue(1).getString()[0],
});

const ReminderNotification = ({ id, due }: Reminder) => {
    const application = useApplication();
    const [notification, setNotification] = useState<Gio.Notification | null>(null);

    useEffect(() => () => {
        const task = useStore.getState().tasks.find((current) => current.id === id);
        if (!isCurrentReminder(task, due)) {
            application.withdrawNotification(id);
        }
    }, [application, due, id]);

    useEffect(() => {
        const store = useStore.getState();
        const task = store.tasks.find((current) => current.id === id);
        if (notification === null || !isPendingReminder(task, due)) {
            return;
        }

        const target = createReminderTarget(task.id, due);
        notification.setTitle(task.title);
        notification.setBody(t("Due {{date}}", { date: formatDateTime(due) }));
        notification.setPriority(Gio.NotificationPriority.HIGH);
        notification.addButtonWithTarget(t("Mark Complete"), "app.complete-reminder", target);
        notification.setDefaultActionAndTarget("app.open-reminder", target);
        application.sendNotification(task.id, notification);
        store.markNotified(task.id, due);
    }, [application, due, id, notification]);

    return createPortal(<GNotification ref={setNotification} />, rootElement);
};

export {
    createReminderTarget,
    readReminderTarget,
    ReminderNotification,
};
