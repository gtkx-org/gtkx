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

export type TaskList = {
    id: string;
    name: string;
    color: string;
};

export type Selection = { kind: "list"; listId: string };
