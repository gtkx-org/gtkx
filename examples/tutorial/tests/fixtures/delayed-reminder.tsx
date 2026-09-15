import * as Gio from "@gtkx/gi/gio";
import { createRoot } from "@gtkx/react";
import { App } from "../../src/app.js";
import { useStore } from "../../src/store/index.js";

const report = process.send?.bind(process);
if (report === undefined) throw new Error("This application fixture requires IPC");

Gio.Settings.new("com.gtkx.tutorial").setInt("reminder-minutes", 1);
const due = Date.now() + 65_000;
const controlDue = new Date(Date.now() + 30_000).toISOString();
useStore.setState((state) => ({
    tasks: state.tasks.map((task) => ({
        ...task,
        done: false,
        deleted: false,
        due: task.id === "t2" ? new Date(due).toISOString() : task.id === "t4" ? controlDue : null,
        lastNotifiedDue: null,
    })),
}));
const unsubscribe = useStore.subscribe((state) => {
    if (state.tasks.some((task) => task.id === "t4" && task.lastNotifiedDue === controlDue)) {
        unsubscribe();
        report({ due });
    }
});

createRoot().render(<App />);
