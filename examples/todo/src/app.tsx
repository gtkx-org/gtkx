import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwToastOverlay,
    AdwToolbarView,
    GtkBox,
    GtkButton,
    GtkLabel,
    GtkListBox,
    GtkScrolledWindow,
    quit,
    x,
} from "@gtkx/react";
import { useRef } from "react";
import { FilterBar } from "./components/filter-bar.js";
import { TodoInput } from "./components/todo-input.js";
import { TodoRow } from "./components/todo-row.js";
import { useTodos } from "./hooks/use-todos.js";

const EmptyState = ({ hasTodos }: { hasTodos: boolean }) => (
    <GtkBox
        orientation={Gtk.Orientation.VERTICAL}
        spacing={12}
        valign={Gtk.Align.CENTER}
        vexpand
        marginTop={40}
        marginBottom={40}
    >
        <GtkLabel label={hasTodos ? "No matching tasks" : "No tasks yet"} cssClasses={["title-2", "dim-label"]} />
        <GtkLabel
            label={hasTodos ? "Try a different filter" : "Add a task to get started"}
            cssClasses={["dim-label"]}
        />
    </GtkBox>
);

const Footer = ({
    activeCount,
    completedCount,
    onClearCompleted,
}: {
    activeCount: number;
    completedCount: number;
    onClearCompleted: () => void;
}) => (
    <GtkBox spacing={12} marginTop={8}>
        <GtkLabel
            label={`${activeCount} item${activeCount !== 1 ? "s" : ""} left`}
            cssClasses={["dim-label"]}
            hexpand
            halign={Gtk.Align.START}
        />
        {completedCount > 0 && (
            <GtkButton
                label="Clear completed"
                cssClasses={["flat"]}
                onClicked={onClearCompleted}
                name="clear-completed"
            />
        )}
    </GtkBox>
);

interface AppProps {
    onClose?: () => void;
}

export const App = ({ onClose = quit }: AppProps) => {
    const {
        todos,
        filter,
        filteredTodos,
        addTodo,
        toggleTodo,
        deleteTodo,
        clearCompleted,
        setFilter,
        activeCount,
        completedCount,
    } = useTodos();

    const toastOverlayRef = useRef<Adw.ToastOverlay>(null);

    const showToast = (message: string) => {
        const toast = new Adw.Toast(message);
        toast.setTimeout(2);
        toastOverlayRef.current?.addToast(toast);
    };

    const handleAdd = (text: string) => {
        addTodo(text);
        showToast("Task added");
    };

    const handleDelete = (id: number) => {
        deleteTodo(id);
        showToast("Task deleted");
    };

    return (
        <AdwApplicationWindow title="Tasks" defaultWidth={450} defaultHeight={600} onClose={onClose}>
            <AdwToolbarView>
                <x.ToolbarTop>
                    <AdwHeaderBar>
                        <x.Slot for={AdwHeaderBar} id="titleWidget">
                            <GtkLabel label="Tasks" cssClasses={["title"]} />
                        </x.Slot>
                    </AdwHeaderBar>
                </x.ToolbarTop>

                <AdwToastOverlay ref={toastOverlayRef}>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <TodoInput onAdd={handleAdd} />

                        {todos.length > 0 && <FilterBar filter={filter} onFilterChange={setFilter} />}

                        {filteredTodos.length === 0 ? (
                            <EmptyState hasTodos={todos.length > 0} />
                        ) : (
                            <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER} name="todo-list">
                                <GtkListBox cssClasses={["boxed-list"]} selectionMode={Gtk.SelectionMode.NONE}>
                                    {filteredTodos.map((todo) => (
                                        <TodoRow
                                            key={todo.id}
                                            todo={todo}
                                            onToggle={toggleTodo}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </GtkListBox>
                            </GtkScrolledWindow>
                        )}

                        {todos.length > 0 && (
                            <Footer
                                activeCount={activeCount}
                                completedCount={completedCount}
                                onClearCompleted={clearCompleted}
                            />
                        )}
                    </GtkBox>
                </AdwToastOverlay>
            </AdwToolbarView>
        </AdwApplicationWindow>
    );
};

export default App;
