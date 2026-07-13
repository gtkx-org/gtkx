import * as GLib from "@gtkx/gi/glib";
import type { Task, TaskList } from "./types.js";

const APP_ID = "com.gtkx.tutorial";
const DATA_DIR = GLib.buildFilenamev([GLib.getUserDataDir(), APP_ID]);
const TASKS_PATH = GLib.buildFilenamev([DATA_DIR, "tasks.json"]);
const SCHEMA_VERSION = 1;

export type PersistedState = {
    version: number;
    lists: TaskList[];
    tasks: Task[];
};

const encode = (value: string): number[] => Array.from(new TextEncoder().encode(value));
const decode = (bytes: number[]): string => new TextDecoder().decode(new Uint8Array(bytes));

const isoInDays = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(18, 0, 0, 0);
    return date.toISOString();
};

const seed = (): PersistedState => {
    const now = new Date().toISOString();
    const lists: TaskList[] = [
        { id: "personal", name: "Personal", color: "#3584e4" },
        { id: "work", name: "Work", color: "#2ec27e" },
        { id: "shopping", name: "Shopping", color: "#e66100" },
    ];
    const make = (task: Partial<Task> & Pick<Task, "id" | "listId" | "title" | "position">): Task => ({
        notes: "",
        done: false,
        important: false,
        deleted: false,
        due: null,
        createdAt: now,
        completedAt: null,
        ...task,
    });
    const tasks: Task[] = [
        make({
            id: "t1",
            listId: "personal",
            title: "Welcome to Tasks",
            position: 0,
            notes: "This is your first task. Tick the checkbox to complete it, or open it to add notes and a due date.",
        }),
        make({
            id: "t2",
            listId: "personal",
            title: "Water the plants",
            position: 1,
            due: isoInDays(0),
            important: true,
        }),
        make({ id: "t3", listId: "work", title: "Prepare the weekly report", position: 0, due: isoInDays(1) }),
        make({ id: "t4", listId: "work", title: "Review pull requests", position: 1 }),
        make({ id: "t5", listId: "shopping", title: "Buy oat milk", position: 0 }),
        make({
            id: "t6",
            listId: "shopping",
            title: "Order birthday gift",
            position: 1,
            due: isoInDays(3),
            important: true,
        }),
    ];
    return { version: SCHEMA_VERSION, lists, tasks };
};

export const loadState = (): PersistedState => {
    try {
        if (!GLib.fileTest(TASKS_PATH, GLib.FileTest.EXISTS)) return seed();
        const [ok, bytes] = GLib.fileGetContents(TASKS_PATH);
        if (!ok) return seed();
        const parsed = JSON.parse(decode(bytes)) as PersistedState;
        if (parsed?.version !== SCHEMA_VERSION) return seed();
        return parsed;
    } catch {
        return seed();
    }
};

export const saveState = (state: PersistedState): void => {
    GLib.mkdirWithParents(DATA_DIR, 0o755);
    GLib.fileSetContents(TASKS_PATH, encode(JSON.stringify(state, null, 2)));
};
