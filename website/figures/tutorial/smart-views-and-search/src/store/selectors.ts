import { isToday } from "../format.js";
import type { Filter, Selection, SmartView, Task, TaskList } from "../types.js";

const SMART_TITLES: Record<SmartView, string> = {
    all: "All Tasks",
    today: "Today",
    important: "Important",
    trash: "Trash",
};

export const selectionKey = (selection: Selection): string =>
    selection.kind === "smart"
        ? `smart:${selection.view}`
        : `list:${selection.listId}`;

export const selectionTitle = (
    selection: Selection,
    lists: TaskList[],
): string =>
    selection.kind === "list"
        ? (lists.find((list) => list.id === selection.listId)?.name ?? "Tasks")
        : SMART_TITLES[selection.view];

export const addListId = (selection: Selection, lists: TaskList[]): string =>
    selection.kind === "list" ? selection.listId : (lists[0]?.id ?? "");

const inSelection = (task: Task, selection: Selection): boolean => {
    if (selection.kind === "list")
        return !task.deleted && task.listId === selection.listId;
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
    const needle = query.toLowerCase();
    return (
        task.title.toLowerCase().includes(needle) ||
        task.notes.toLowerCase().includes(needle)
    );
};

const matchesFilter = (task: Task, filter: Filter): boolean => {
    if (filter === "open") return !task.done;
    if (filter === "done") return task.done;
    return true;
};

export type VisibleOptions = { query: string; filter: Filter };

export const visibleTasks = (
    tasks: Task[],
    selection: Selection,
    options: VisibleOptions,
): Task[] =>
    tasks
        .filter(
            (task) =>
                inSelection(task, selection) &&
                matchesQuery(task, options.query) &&
                matchesFilter(task, options.filter),
        )
        .sort((a, b) => a.position - b.position);

export type SidebarCounts = {
    all: number;
    today: number;
    important: number;
    trash: number;
    lists: Record<string, number>;
};

export const sidebarCounts = (
    tasks: Task[],
    lists: TaskList[],
): SidebarCounts => {
    const open = tasks.filter((task) => !task.deleted && !task.done);
    return {
        all: open.length,
        today: open.filter((task) => isToday(task.due)).length,
        important: open.filter((task) => task.important).length,
        trash: tasks.filter((task) => task.deleted).length,
        lists: Object.fromEntries(
            lists.map((list) => [
                list.id,
                open.filter((task) => task.listId === list.id).length,
            ]),
        ),
    };
};

export type EmptyState = { icon: string; title: string; description: string };

const SMART_EMPTY: Record<SmartView, EmptyState> = {
    all: {
        icon: "view-list-symbolic",
        title: "No Tasks Yet",
        description: "Add a task above to get started",
    },
    today: {
        icon: "x-office-calendar-symbolic",
        title: "Nothing Due Today",
        description: "Tasks due today appear here",
    },
    important: {
        icon: "starred-symbolic",
        title: "No Important Tasks",
        description: "Star a task to find it here",
    },
    trash: {
        icon: "user-trash-symbolic",
        title: "Trash Is Empty",
        description: "Deleted tasks appear here",
    },
};

export const emptyState = (selection: Selection, query: string): EmptyState => {
    if (query)
        return {
            icon: "system-search-symbolic",
            title: "No Results",
            description: `No tasks match “${query}”`,
        };
    if (selection.kind === "smart") return SMART_EMPTY[selection.view];
    return SMART_EMPTY.all;
};
