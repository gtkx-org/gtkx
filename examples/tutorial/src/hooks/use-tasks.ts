import { useEffect, useState } from "react";
import { loadState, type PersistedState, saveState } from "../store.js";
import type { Task } from "../types.js";

const reindex = (tasks: Task[]): Task[] => tasks.map((task, index) => ({ ...task, position: index }));

const now = (): string => new Date().toISOString();

export type TasksApi = ReturnType<typeof useTasks>;

export const useTasks = () => {
    const [state, setState] = useState<PersistedState>(loadState);

    useEffect(() => {
        const handle = setTimeout(() => saveState(state), 500);
        return () => clearTimeout(handle);
    }, [state]);

    const mutate = (updater: (tasks: Task[]) => Task[]): void =>
        setState((current) => ({ ...current, tasks: updater(current.tasks) }));

    const patch = (id: string, fields: Partial<Task>): void =>
        mutate((tasks) => tasks.map((task) => (task.id === id ? { ...task, ...fields } : task)));

    const withDone = (task: Task, done: boolean): Task => ({
        ...task,
        done,
        completedAt: done ? now() : null,
    });

    const addTask = (listId: string, title: string): string | null => {
        const trimmed = title.trim();
        if (!trimmed) return null;
        const id = crypto.randomUUID();
        mutate((tasks) => [
            ...tasks,
            {
                id,
                listId,
                title: trimmed,
                notes: "",
                done: false,
                important: false,
                deleted: false,
                due: null,
                position: tasks.length,
                createdAt: now(),
                completedAt: null,
            },
        ]);
        return id;
    };

    const setDone = (id: string, done: boolean): void =>
        mutate((tasks) => tasks.map((task) => (task.id === id ? withDone(task, done) : task)));

    const toggleDone = (id: string): void =>
        mutate((tasks) => tasks.map((task) => (task.id === id ? withDone(task, !task.done) : task)));

    const setImportant = (id: string, important: boolean): void => patch(id, { important });

    const updateTask = (id: string, fields: Partial<Pick<Task, "title" | "notes" | "due" | "listId">>): void =>
        patch(id, fields);

    const moveToTrash = (id: string): void => patch(id, { deleted: true });

    const restore = (id: string): void => patch(id, { deleted: false });

    const deleteForever = (id: string): void => mutate((tasks) => tasks.filter((task) => task.id !== id));

    const moveToList = (ids: string[], listId: string): void =>
        mutate((tasks) => tasks.map((task) => (ids.includes(task.id) ? { ...task, listId } : task)));

    const completeMany = (ids: string[]): void =>
        mutate((tasks) => tasks.map((task) => (ids.includes(task.id) ? withDone(task, true) : task)));

    const trashMany = (ids: string[]): void =>
        mutate((tasks) => tasks.map((task) => (ids.includes(task.id) ? { ...task, deleted: true } : task)));

    const reorder = (draggedId: string, targetId: string): void =>
        mutate((tasks) => {
            const from = tasks.findIndex((task) => task.id === draggedId);
            const to = tasks.findIndex((task) => task.id === targetId);
            if (from === -1 || to === -1 || from === to) return tasks;
            const next = [...tasks];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return reindex(next);
        });

    const addList = (name: string, color: string): void => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setState((current) => ({
            ...current,
            lists: [...current.lists, { id: crypto.randomUUID(), name: trimmed, color }],
        }));
    };

    const flush = (): void => saveState(state);

    return {
        lists: state.lists,
        tasks: state.tasks,
        addTask,
        setDone,
        toggleDone,
        setImportant,
        updateTask,
        moveToTrash,
        restore,
        deleteForever,
        moveToList,
        completeMany,
        trashMany,
        reorder,
        addList,
        flush,
    };
};
