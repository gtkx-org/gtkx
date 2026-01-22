export type Todo = {
    id: number;
    text: string;
    completed: boolean;
};

export type Filter = "all" | "active" | "completed";
