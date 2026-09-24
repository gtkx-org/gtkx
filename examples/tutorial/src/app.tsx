import type * as Adw from "@gtkx/gi/adw";
import * as GLib from "@gtkx/gi/glib";
import { AdwApplication } from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { useState } from "react";
import { SettingsProvider } from "./components/settings.js";
import { Window } from "./components/window.js";
import { isCurrentReminder } from "./hooks/use-reminders.js";
import { ALL_TASKS, openTask } from "./navigation.js";
import { readReminderTarget } from "./notifications.js";
import { useStore } from "./store/index.js";

const activeReminder = (parameter: unknown) => {
    const { due, id } = readReminderTarget(parameter as GLib.Variant);
    const task = useStore.getState().tasks.find((candidate) => candidate.id === id);

    return isCurrentReminder(task, due) && task.lastNotifiedDue === due ? task : undefined;
};

const ApplicationActions = ({ application }: { application: Adw.Application | null }) => (
    <>
        <GSimpleAction
            name="complete-task"
            parameterType={GLib.VariantType.new("s")}
            onActivate={(parameter) => {
                useStore.getState().setDone((parameter as GLib.Variant).getString()[0], true);
            }}
        />
        <GSimpleAction
            name="open-task"
            parameterType={GLib.VariantType.new("s")}
            onActivate={(parameter) => {
                openTask(ALL_TASKS, (parameter as GLib.Variant).getString()[0]);
                application?.activate();
            }}
        />
        <GSimpleAction
            name="complete-reminder"
            parameterType={GLib.VariantType.new("(ss)")}
            onActivate={(parameter) => {
                const task = activeReminder(parameter);
                if (task !== undefined) {
                    useStore.getState().setDone(task.id, true);
                }
            }}
        />
        <GSimpleAction
            name="open-reminder"
            parameterType={GLib.VariantType.new("(ss)")}
            onActivate={(parameter) => {
                const task = activeReminder(parameter);
                if (task === undefined) {
                    return;
                }
                openTask(ALL_TASKS, task.id);
                application?.activate();
                application?.withdrawNotification(task.id);
            }}
        />
    </>
);

function App() {
    const [application, setApplication] = useState<Adw.Application | null>(null);

    return (
        <AdwApplication
            ref={setApplication}
            onActivate={() => application?.getActiveWindow()?.present()}
            actionAccels={[
                { detailedActionName: "win.new", accels: ["<Control>n"] },
                { detailedActionName: "win.preferences", accels: ["<Control>comma"] },
                { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
            ]}
            actions={<ApplicationActions application={application} />}
        >
            <SettingsProvider>
                <Window />
            </SettingsProvider>
        </AdwApplication>
    );
}

export {
    App,
};
