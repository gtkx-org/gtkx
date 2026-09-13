import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { t } from "@gtkx/i18n";
import type { Task } from "./types.js";
import { formatDateTime } from "./format.js";

export const buildReminder = (task: Task, due: string): Gio.Notification => {
    const notification = Gio.Notification.new(task.title);
    notification.setBody(t("Due {{date}}", { date: formatDateTime(due) }));
    notification.setPriority(Gio.NotificationPriority.HIGH);
    notification.addButtonWithTarget(t("Mark Complete"), "app.complete-task", GLib.Variant.newString(task.id));
    notification.setDefaultActionAndTarget("app.open-task", GLib.Variant.newString(task.id));
    return notification;
};
