import { Align, Orientation, SelectionMode } from "@gtkx/ffi/gtk";
import { ApplicationWindow, Box, Button, HeaderBar, Label, ListBox, quit, ScrolledWindow } from "@gtkx/react";
import { useCallback, useMemo, useState } from "react";
import { TodoInput } from "./todo-input.js";
import { TodoRow } from "./todo-row.js";
import type { Filter, Todo } from "./types.js";
import { ViewSwitcher } from "./view-switcher.js";

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

    const itemText = activeCount === 1 ? "task" : "tasks";

    return (
        <ApplicationWindow title="Tasks" defaultWidth={400} defaultHeight={500} onCloseRequest={quit}>
            <HeaderBar.Root>
                <HeaderBar.TitleWidget>
                    <Label label="Tasks" cssClasses={["title"]} />
                </HeaderBar.TitleWidget>
            </HeaderBar.Root>

            <Box
                orientation={Orientation.VERTICAL}
                spacing={12}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <TodoInput onAdd={addTodo} />

                {todos.length > 0 && <ViewSwitcher filter={filter} onFilterChange={setFilter} />}

                {filteredTodos.length === 0 ? (
                    <Box
                        orientation={Orientation.VERTICAL}
                        vexpand
                        valign={Align.CENTER}
                        halign={Align.CENTER}
                        spacing={12}
                    >
                        <Label
                            label={todos.length === 0 ? "No tasks yet" : "No tasks to display"}
                            cssClasses={["dim-label", "title-3"]}
                            name="empty-message"
                        />
                        {todos.length === 0 && (
                            <Label label="Add a task above to get started" cssClasses={["dim-label"]} />
                        )}
                    </Box>
                ) : (
                    <ScrolledWindow vexpand hscrollbarPolicy={2} name="todo-list">
                        <ListBox cssClasses={["boxed-list"]} selectionMode={SelectionMode.NONE}>
                            {filteredTodos.map((todo) => (
                                <TodoRow key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
                            ))}
                        </ListBox>
                    </ScrolledWindow>
                )}

                {todos.length > 0 && (
                    <Box orientation={Orientation.HORIZONTAL} spacing={8}>
                        <Label
                            label={`${activeCount} ${itemText} remaining`}
                            cssClasses={["dim-label"]}
                            halign={Align.START}
                            hexpand
                            name="items-left"
                        />
                        <Button
                            label="Clear Completed"
                            cssClasses={["flat"]}
                            sensitive={completedCount > 0}
                            onClicked={clearCompleted}
                            name="clear-completed"
                        />
                    </Box>
                )}
            </Box>
        </ApplicationWindow>
    );
};

export default App;

export const appId = "com.gtkx.todo";
