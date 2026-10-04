type TaskList = {
    id: string;
    name: string;
    color: string;
};

type Task = {
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

type SmartView = "all" | "today" | "important" | "trash";

type Selection = { kind: "smart"; view: SmartView } | { kind: "list"; listId: string };

type Filter = "all" | "open" | "done";

type DialogKind = "none" | "about" | "shortcuts" | "preferences" | "new-list";

type DialogState = { kind: DialogKind } | { kind: "delete-task"; task: Task };

export {
    type DialogKind,
    type DialogState,
    type Filter,
    type Selection,
    type SmartView,
    type Task,
    type TaskList,
};
