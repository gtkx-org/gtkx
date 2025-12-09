import { Orientation } from "@gtkx/ffi/gtk";
import { ApplicationWindow, Box, Label, quit } from "@gtkx/react";
import { useCallback, useMemo, useState } from "react";
import { TodoFilters } from "./todo-filters.js";
import { TodoInput } from "./todo-input.js";
import { TodoList } from "./todo-list.js";
import type { Filter, Todo } from "./types.js";

let nextId = 1;

export const App = () => {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [filter, setFilter] = useState<Filter>("all");

    const addTodo = useCallback((text: string) => {
        setTodos((prev) => [...prev, { id: nextId++, text, completed: false }]);
    }, []);

    const toggleTodo = useCallback((id: number) => {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)));
    }, []);

    const deleteTodo = useCallback((id: number) => {
        setTodos((prev) => prev.filter((todo) => todo.id !== id));
    }, []);

    const clearCompleted = useCallback(() => {
        setTodos((prev) => prev.filter((todo) => !todo.completed));
    }, []);

    const filteredTodos = useMemo(() => {
        switch (filter) {
            case "active":
                return todos.filter((todo) => !todo.completed);
            case "completed":
                return todos.filter((todo) => todo.completed);
            default:
                return todos;
        }
    }, [todos, filter]);

    const activeCount = useMemo(() => todos.filter((todo) => !todo.completed).length, [todos]);
    const completedCount = useMemo(() => todos.filter((todo) => todo.completed).length, [todos]);

    return (
        <ApplicationWindow title="Todo App" defaultWidth={400} defaultHeight={500} onCloseRequest={quit}>
            <Box
                orientation={Orientation.VERTICAL}
                spacing={16}
                marginTop={16}
                marginBottom={16}
                marginStart={16}
                marginEnd={16}
            >
                <Label.Root label="Todo App" name="app-title" />
                <TodoInput onAdd={addTodo} />
                <TodoList todos={filteredTodos} onToggle={toggleTodo} onDelete={deleteTodo} />
                {todos.length > 0 && (
                    <TodoFilters
                        filter={filter}
                        onFilterChange={setFilter}
                        activeCount={activeCount}
                        completedCount={completedCount}
                        onClearCompleted={clearCompleted}
                    />
                )}
            </Box>
        </ApplicationWindow>
    );
};

export default App;

export const appId = "com.gtkx.todo";
