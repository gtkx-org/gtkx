import { t } from "@gtkx/i18n";
import { isToday } from "../format.js";
import type { Filter, Selection, SmartView, SortOrder, Task, TaskList } from "../types.js";

const SMART_TITLES: Record<SmartView, string> = {
    all: t("All Tasks"),
    today: t("Today"),
    important: t("Important"),
    trash: t("Trash"),
};

export const selectionKey = (selection: Selection): string =>
    selection.kind === "smart" ? `smart:${selection.view}` : `list:${selection.listId}`;

export const selectionTitle = (selection: Selection, lists: TaskList[]): string =>
    selection.kind === "list"
        ? (lists.find((list) => list.id === selection.listId)?.name ?? t("Tasks"))
        : SMART_TITLES[selection.view];

export const addListId = (selection: Selection, lists: TaskList[]): string =>
    selection.kind === "list" ? selection.listId : (lists[0]?.id ?? "");

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
    const needle = query.toLowerCase();
    return task.title.toLowerCase().includes(needle) || task.notes.toLowerCase().includes(needle);
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

export type VisibleOptions = { query: string; filter: Filter; sortOrder: SortOrder };

export const visibleTasks = (tasks: Task[], selection: Selection, options: VisibleOptions): Task[] =>
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
    const open = tasks.filter((task) => !task.deleted && !task.done);
    return {
        all: open.length,
        today: open.filter((task) => isToday(task.due)).length,
        important: open.filter((task) => task.important).length,
        trash: tasks.filter((task) => task.deleted).length,
        lists: Object.fromEntries(
            lists.map((list) => [list.id, open.filter((task) => task.listId === list.id).length]),
        ),
    };
};

export const isReorderable = (selection: Selection, query: string, sortOrder: SortOrder): boolean =>
    sortOrder === "manual" && query === "" && !(selection.kind === "smart" && selection.view === "trash");

export type EmptyState = { icon: string; title: string; description: string };

const SMART_EMPTY: Record<SmartView, EmptyState> = {
    all: {
        icon: "view-list-symbolic",
        title: t("No Tasks Yet"),
        description: t("Add a task above to get started"),
    },
    today: {
        icon: "x-office-calendar-symbolic",
        title: t("Nothing Due Today"),
        description: t("Tasks due today appear here"),
    },
    important: {
        icon: "starred-symbolic",
        title: t("No Important Tasks"),
        description: t("Star a task to find it here"),
    },
    trash: {
        icon: "user-trash-symbolic",
        title: t("Trash Is Empty"),
        description: t("Deleted tasks appear here"),
    },
};

export const emptyState = (selection: Selection, query: string): EmptyState => {
    if (query) {
        return {
            icon: "system-search-symbolic",
            title: t("No Results"),
            description: t("No tasks match “{{query}}”", { query }),
        };
    }
    if (selection.kind === "smart") return SMART_EMPTY[selection.view];
    return SMART_EMPTY.all;
};
