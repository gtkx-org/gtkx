export type TaskList = {
    id: string;
    name: string;
    color: string;
};

export type Task = {
    id: string;
    listId: string;
    title: string;
    notes: string;
    done: boolean;
    important: boolean;
    deleted: boolean;
    due: string | null;
    position: number;
    createdAt: string;
    completedAt: string | null;
};

export type SmartView = "all" | "today" | "important" | "trash";

export type Selection = { kind: "smart"; view: SmartView } | { kind: "list"; listId: string };

export type Filter = "all" | "open" | "done";

export enum SortValue {
    manual = 0,
    "due-date" = 1,
    title = 2,
    created = 3,
}

export type SortOrder = keyof typeof SortValue;

export type DialogKind = "none" | "about" | "shortcuts" | "preferences" | "new-list" | "delete-task";
