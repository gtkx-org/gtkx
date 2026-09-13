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
    lastNotifiedDue: string | null;
};

export type SmartView = "all" | "today" | "important" | "trash";

export type Selection = { kind: "smart"; view: SmartView } | { kind: "list"; listId: string };

export type Filter = "all" | "open" | "done";

export type DialogKind = "none" | "about" | "shortcuts" | "preferences" | "new-list";

export type DialogState = { kind: DialogKind } | { kind: "delete-task"; task: Task };
