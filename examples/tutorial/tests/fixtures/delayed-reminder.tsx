import * as Gio from "@gtkx/gi/gio";
import { createRoot } from "@gtkx/react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { App } from "../../src/app.js";
import { useStore } from "../../src/store/index.js";

if (process.send === undefined) {
    throw new Error("This application fixture requires IPC");
}
const report = process.send.bind(process);

Gio.Settings.new(schema.id).setInt("reminder-minutes", 1);
const due = Date.now() + 65_000;
const controlDue = new Date(Date.now() + 30_000).toISOString();

const dueFor = (id: string): string | null => {
    if (id === "t2") {
        return new Date(due).toISOString();
    }

    return id === "t4" ? controlDue : null;
};

useStore.setState((state) => ({
    tasks: state.tasks.map((task) => ({
        ...task,
        done: false,
        deleted: false,
        due: dueFor(task.id),
        lastNotifiedDue: null,
    })),
}));
const unsubscribe = useStore.subscribe((state) => {
    if (state.tasks.every((task) => !(task.id === "t4" && task.lastNotifiedDue === controlDue))) {
        return;
    }

    unsubscribe();
    report({ due });
});

createRoot().render(<App />);
