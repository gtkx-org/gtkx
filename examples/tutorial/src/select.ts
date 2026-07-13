import { isToday } from "./format.js";
import type { Selection, Task, TaskList } from "./types.js";

export type Filter = "all" | "open" | "done";
export type SortOrder = "manual" | "due-date" | "title" | "created";

const inSelection = (task: Task, selection: Selection): boolean => {
    if (selection.kind === "list") return !task.deleted && task.listId === selection.listId;
    switch (selection.view) {
        case "all":
            return !task.deleted;
        case "today":
            return !task.deleted && isToday(task.due);
        case "important":
            return !task.deleted && task.important;
        case "trash":
            return task.deleted;
    }
};

const matchesQuery = (task: Task, query: string): boolean => {
    if (!query) return true;
    const q = query.toLowerCase();
    return task.title.toLowerCase().includes(q) || task.notes.toLowerCase().includes(q);
};

const matchesFilter = (task: Task, filter: Filter): boolean => {
    if (filter === "open") return !task.done;
    if (filter === "done") return task.done;
    return true;
};

const byOrder =
    (order: SortOrder) =>
    (a: Task, b: Task): number => {
        switch (order) {
            case "due-date": {
                if (a.due === b.due) return a.position - b.position;
                if (!a.due) return 1;
                if (!b.due) return -1;
                return a.due < b.due ? -1 : 1;
            }
            case "title":
                return a.title.localeCompare(b.title);
            case "created":
                return a.createdAt.localeCompare(b.createdAt);
            default:
                return a.position - b.position;
        }
    };

export const visibleTasks = (
    tasks: Task[],
    selection: Selection,
    options: { query: string; filter: Filter; sortOrder: SortOrder },
): Task[] =>
    tasks
        .filter(
            (task) =>
                inSelection(task, selection) &&
                matchesQuery(task, options.query) &&
                matchesFilter(task, options.filter),
        )
        .sort(byOrder(options.sortOrder));

export type SidebarCounts = {
    all: number;
    today: number;
    important: number;
    trash: number;
    lists: Record<string, number>;
};

export const sidebarCounts = (tasks: Task[], lists: TaskList[]): SidebarCounts => {
    const active = tasks.filter((task) => !task.deleted && !task.done);
    return {
        all: active.length,
        today: active.filter((task) => isToday(task.due)).length,
        important: active.filter((task) => task.important).length,
        trash: tasks.filter((task) => task.deleted).length,
        lists: Object.fromEntries(
            lists.map((list) => [list.id, active.filter((task) => task.listId === list.id).length]),
        ),
    };
};
