import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { t } from "@gtkx/i18n";
import { GNotification } from "@gtkx/jsx/gio";
import { createPortal, rootElement, useApplication } from "@gtkx/react";
import { useEffect, useState } from "react";
import { isPendingReminder, type Reminder } from "./hooks/use-reminders.js";
import { formatDateTime } from "./format.js";
import { useStore } from "./store/index.js";

export const ReminderNotification = ({ id, due }: Reminder) => {
    const application = useApplication();
    const [notification, setNotification] = useState<Gio.Notification | null>(null);

    useEffect(() => {
        const store = useStore.getState();
        const task = store.tasks.find((current) => current.id === id);
        if (notification === null || !isPendingReminder(task, due)) return;

        notification.setTitle(task.title);
        notification.setBody(t("Due {{date}}", { date: formatDateTime(due) }));
        notification.setPriority(Gio.NotificationPriority.HIGH);
        notification.addButtonWithTarget(t("Mark Complete"), "app.complete-task", GLib.Variant.newString(task.id));
        notification.setDefaultActionAndTarget("app.open-task", GLib.Variant.newString(task.id));
        application.sendNotification(task.id, notification);
        store.markNotified(task.id, due);
    }, [application, due, id, notification]);

    return createPortal(<GNotification ref={setNotification} />, rootElement);
};
