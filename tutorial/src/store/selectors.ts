import { t } from "@gtkx/i18n";
import type { SortOrder } from "../settings.js";
import type { Filter, Selection, SmartView, Task, TaskList } from "../types.js";
import { isToday } from "../format.js";

const SMART_TITLES: Record<SmartView, string> = {
    all: t("All Tasks"),
    today: t("Today"),
    important: t("Important"),
    trash: t("Trash"),
};

const selectionKey = (selection: Selection): string =>
    selection.kind === "smart" ? `smart:${selection.view}` : `list:${selection.listId}`;

const selectionTitle = (selection: Selection, lists: TaskList[]): string =>
    selection.kind === "list"
        ? (lists.find((list) => list.id === selection.listId)?.name ?? t("Tasks"))
        : SMART_TITLES[selection.view];

const addListId = (selection: Selection, lists: TaskList[]): string =>
    selection.kind === "list" ? selection.listId : (lists[0]?.id ?? "");

const isInSelection = (task: Task, selection: Selection): boolean => {
    if (selection.kind === "list") {
        return !task.deleted && task.listId === selection.listId;
    }
    switch (selection.view) {
        case "all": {
            return !task.deleted;
        }
        case "today": {
            return !task.deleted && isToday(task.due);
        }
        case "important": {
            return !task.deleted && task.important;
        }
        case "trash": {
            return task.deleted;
        }
    }
};

const isQueryMatch = (task: Task, query: string): boolean => {
    if (!query) {
        return true;
    }
    const needle = query.toLowerCase();

    return task.title.toLowerCase().includes(needle) || task.notes.toLowerCase().includes(needle);
};

const isFilterMatch = (task: Task, filter: Filter): boolean => {
    if (filter === "open") {
        return !task.done;
    }
    if (filter === "done") {
        return task.done;
    }

    return true;
};

type TaskComparator = (a: Task, b: Task) => number;

const byPosition: TaskComparator = (a, b) => a.position - b.position;

const byDue: TaskComparator = (a, b) => {
    if (a.due === b.due) {
        return byPosition(a, b);
    }
    if (a.due === null) {
        return 1;
    }
    if (b.due === null) {
        return -1;
    }

    return a.due < b.due ? -1 : 1;
};

const TASK_COMPARATORS: Record<SortOrder, TaskComparator> = {
    manual: byPosition,
    "due-date": byDue,
    title: (a, b) => a.title.localeCompare(b.title),
    created: (a, b) => a.createdAt.localeCompare(b.createdAt),
};

type VisibleOptions = { query: string; filter: Filter; sortOrder: SortOrder };

const visibleTasks = (tasks: Task[], selection: Selection, options: VisibleOptions): Task[] =>
    tasks
        .filter(
            (task) =>
                isInSelection(task, selection) &&
                isQueryMatch(task, options.query) &&
                isFilterMatch(task, options.filter),
        )
        .toSorted(TASK_COMPARATORS[options.sortOrder]);

type SidebarCounts = {
    all: number;
    today: number;
    important: number;
    trash: number;
    lists: Record<string, number>;
};

const sidebarCounts = (tasks: Task[], lists: TaskList[]): SidebarCounts => {
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

const isReorderable = (
    selection: Selection,
    query: string,
    filter: Filter,
    sortOrder: SortOrder,
): boolean =>
    sortOrder === "manual" &&
    query === "" &&
    filter === "all" &&
    !(selection.kind === "smart" && selection.view === "trash");

type EmptyState = { icon: string; title: string; description: string };

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

const emptyState = (selection: Selection, query: string): EmptyState => {
    if (query) {
        return {
            icon: "system-search-symbolic",
            title: t("No Results"),
            description: t("No tasks match “{{query}}”", { query }),
        };
    }
    if (selection.kind === "smart") {
        return SMART_EMPTY[selection.view];
    }

    return SMART_EMPTY.all;
};

export {
    addListId,
    emptyState,
    type EmptyState,
    isReorderable,
    selectionKey,
    selectionTitle,
    sidebarCounts,
    type SidebarCounts,
    type VisibleOptions,
    visibleTasks,
};
