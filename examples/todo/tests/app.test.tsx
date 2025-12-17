import { getInterface } from "@gtkx/ffi";
import { AccessibleRole, Editable, type Label, type ToggleButton, type Widget } from "@gtkx/ffi/gtk";
import { cleanup, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/app.js";

describe("Todo App", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("initial state", () => {
        it("renders with title", async () => {
            await render(<App />, { wrapper: false });

            const title = await screen.findByText("Tasks");
            expect(title).toBeDefined();
        });

        it("shows empty message when no todos", async () => {
            await render(<App />, { wrapper: false });

            const emptyMessage = await screen.findByText("No tasks yet");
            expect(emptyMessage).toBeDefined();
        });

        it("has an input field for new todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            expect(input).toBeDefined();
        });

        it("has an add button", async () => {
            await render(<App />, { wrapper: false });

            const addButton = await screen.findByTestId("add-button");
            expect(addButton).toBeDefined();
        });

        it("does not show filters when no todos exist", async () => {
            await render(<App />, { wrapper: false });

            await expect(screen.findByTestId("filter-all", { timeout: 100 })).rejects.toThrow();
        });
    });

    describe("adding todos", () => {
        it("adds a new todo when clicking Add button", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Buy groceries");

            const addButton = await screen.findByTestId("add-button");
            await userEvent.click(addButton);

            const todoText = await screen.findByText("Buy groceries");
            expect(todoText).toBeDefined();
        });

        it("clears input after adding todo", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Buy groceries");

            const addButton = await screen.findByTestId("add-button");
            await userEvent.click(addButton);

            await waitFor(() => {
                const currentText = getInterface(input.id, Editable)?.getText() ?? "";
                expect(currentText).toBe("");
            });
        });

        it("can add multiple todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            const addButton = await screen.findByTestId("add-button");

            await userEvent.type(input, "First todo");
            await userEvent.click(addButton);

            await userEvent.type(input, "Second todo");
            await userEvent.click(addButton);

            await userEvent.type(input, "Third todo");
            await userEvent.click(addButton);

            const first = await screen.findByText("First todo");
            const second = await screen.findByText("Second todo");
            const third = await screen.findByText("Third todo");

            expect(first).toBeDefined();
            expect(second).toBeDefined();
            expect(third).toBeDefined();
        });

        it("does not add empty todos", async () => {
            await render(<App />, { wrapper: false });

            const addButton = await screen.findByTestId("add-button");
            await userEvent.click(addButton);

            const emptyMessage = await screen.findByText("No tasks yet");
            expect(emptyMessage).toBeDefined();
        });

        it("does not add whitespace-only todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "   ");

            const addButton = await screen.findByTestId("add-button");
            await userEvent.click(addButton);

            const emptyMessage = await screen.findByText("No tasks yet");
            expect(emptyMessage).toBeDefined();
        });

        it("shows filters after adding first todo", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "New todo");

            const addButton = await screen.findByTestId("add-button");
            await userEvent.click(addButton);

            const filterAll = await screen.findByTestId("filter-all");
            const filterActive = await screen.findByTestId("filter-active");
            const filterCompleted = await screen.findByTestId("filter-completed");

            expect(filterAll).toBeDefined();
            expect(filterActive).toBeDefined();
            expect(filterCompleted).toBeDefined();
        });
    });

    describe("completing todos", () => {
        it("can toggle a todo as completed", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Test todo");

            const addButton = await screen.findByTestId("add-button");
            await userEvent.click(addButton);

            const checkbox = await screen.findByRole(AccessibleRole.CHECKBOX, { checked: false });
            await userEvent.click(checkbox);

            const checkedCheckbox = await screen.findByRole(AccessibleRole.CHECKBOX, { checked: true });
            expect(checkedCheckbox).toBeDefined();
        });

        it("can toggle a completed todo back to active", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Test todo");

            const addButton = await screen.findByTestId("add-button");
            await userEvent.click(addButton);

            const checkbox = await screen.findByRole(AccessibleRole.CHECKBOX, { checked: false });
            await userEvent.click(checkbox);

            const checkedCheckbox = await screen.findByRole(AccessibleRole.CHECKBOX, { checked: true });
            await userEvent.click(checkedCheckbox);

            const uncheckedCheckbox = await screen.findByRole(AccessibleRole.CHECKBOX, { checked: false });
            expect(uncheckedCheckbox).toBeDefined();
        });

        it("updates item count when completing todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            const addButton = await screen.findByTestId("add-button");

            await userEvent.type(input, "Todo 1");
            await userEvent.click(addButton);
            await userEvent.type(input, "Todo 2");
            await userEvent.click(addButton);

            let itemsLeft = await screen.findByTestId("items-left");
            expect((itemsLeft as Label).getLabel()).toContain("2");

            const checkboxes = await screen.findAllByRole(AccessibleRole.CHECKBOX);
            expect(checkboxes.length).toBeGreaterThanOrEqual(1);
            const firstCheckbox = checkboxes[0] as Widget;
            expect(firstCheckbox).toBeDefined();
            await userEvent.click(firstCheckbox);

            itemsLeft = await screen.findByTestId("items-left");
            expect((itemsLeft as Label).getLabel()).toContain("1");
        });
    });

    describe("deleting todos", () => {
        it("can delete a todo", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Todo to delete");

            const addButton = await screen.findByTestId("add-button");
            await userEvent.click(addButton);

            const todoText = await screen.findByText("Todo to delete");
            expect(todoText).toBeDefined();

            const deleteButton = await screen.findByTestId(/^delete-\d+$/);
            await userEvent.click(deleteButton);

            const emptyMessage = await screen.findByText("No tasks yet");
            expect(emptyMessage).toBeDefined();
        });

        it("deletes only the targeted todo", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            const addButton = await screen.findByTestId("add-button");

            await userEvent.type(input, "Keep this");
            await userEvent.click(addButton);
            await userEvent.type(input, "Delete this");
            await userEvent.click(addButton);

            const deleteButtons = await screen.findAllByTestId(/^delete-\d+$/);
            expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
            const secondDeleteButton = deleteButtons[1] as Widget;
            expect(secondDeleteButton).toBeDefined();
            await userEvent.click(secondDeleteButton);

            const kept = await screen.findByText("Keep this");
            expect(kept).toBeDefined();

            await expect(screen.findByText("Delete this", { timeout: 100 })).rejects.toThrow();
        });
    });

    describe("filtering todos", () => {
        const setupTodosWithMixedState = async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            const addButton = await screen.findByTestId("add-button");

            await userEvent.type(input, "Active todo");
            await userEvent.click(addButton);
            await userEvent.type(input, "Completed todo");
            await userEvent.click(addButton);

            const checkboxes = await screen.findAllByRole(AccessibleRole.CHECKBOX);
            expect(checkboxes.length).toBeGreaterThanOrEqual(2);
            const secondCheckbox = checkboxes[1] as Widget;
            expect(secondCheckbox).toBeDefined();
            await userEvent.click(secondCheckbox);
        };

        it("shows all todos by default", async () => {
            await setupTodosWithMixedState();

            const active = await screen.findByText("Active todo");
            const completed = await screen.findByText("Completed todo");

            expect(active).toBeDefined();
            expect(completed).toBeDefined();
        });

        it("filters to show only active todos", async () => {
            await setupTodosWithMixedState();

            const filterActive = await screen.findByTestId("filter-active");
            await userEvent.click(filterActive);

            const active = await screen.findByText("Active todo");
            expect(active).toBeDefined();

            await expect(screen.findByText("Completed todo", { timeout: 100 })).rejects.toThrow();
        });

        it("filters to show only completed todos", async () => {
            await setupTodosWithMixedState();

            const filterCompleted = await screen.findByTestId("filter-completed");
            await userEvent.click(filterCompleted);

            const completed = await screen.findByText("Completed todo");
            expect(completed).toBeDefined();

            await expect(screen.findByText("Active todo", { timeout: 100 })).rejects.toThrow();
        });

        it("can switch back to all filter", async () => {
            await setupTodosWithMixedState();

            const filterCompleted = await screen.findByTestId("filter-completed");
            await userEvent.click(filterCompleted);

            const filterAll = await screen.findByTestId("filter-all");
            await userEvent.click(filterAll);

            const active = await screen.findByText("Active todo");
            const completed = await screen.findByText("Completed todo");

            expect(active).toBeDefined();
            expect(completed).toBeDefined();
        });

        it("marks the active filter button as active", async () => {
            await setupTodosWithMixedState();

            const filterAll = await screen.findByTestId("filter-all");
            expect((filterAll as ToggleButton).getActive()).toBe(true);

            const filterActive = await screen.findByTestId("filter-active");
            await userEvent.click(filterActive);

            expect((filterActive as ToggleButton).getActive()).toBe(true);
            expect((filterAll as ToggleButton).getActive()).toBe(false);
        });
    });

    describe("clear completed", () => {
        it("removes all completed todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            const addButton = await screen.findByTestId("add-button");

            await userEvent.type(input, "Keep active");
            await userEvent.click(addButton);
            await userEvent.type(input, "Complete me");
            await userEvent.click(addButton);
            await userEvent.type(input, "Also complete");
            await userEvent.click(addButton);

            const checkboxes = await screen.findAllByRole(AccessibleRole.CHECKBOX, { checked: false });
            expect(checkboxes.length).toBeGreaterThanOrEqual(3);
            const secondCheckbox = checkboxes[1] as Widget;
            const thirdCheckbox = checkboxes[2] as Widget;
            expect(secondCheckbox).toBeDefined();
            expect(thirdCheckbox).toBeDefined();
            await userEvent.click(secondCheckbox);
            await userEvent.click(thirdCheckbox);

            const clearButton = await screen.findByTestId("clear-completed");
            await userEvent.click(clearButton);

            const kept = await screen.findByText("Keep active");
            expect(kept).toBeDefined();

            await expect(screen.findByText("Complete me", { timeout: 100 })).rejects.toThrow();
            await expect(screen.findByText("Also complete", { timeout: 100 })).rejects.toThrow();
        });

        it("is disabled when no completed todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Active todo");

            const addButton = await screen.findByTestId("add-button");
            await userEvent.click(addButton);

            const clearButton = await screen.findByTestId("clear-completed");
            expect(clearButton.getSensitive()).toBe(false);
        });

        it("becomes enabled when a todo is completed", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Todo");

            const addButton = await screen.findByTestId("add-button");
            await userEvent.click(addButton);

            const clearButton = await screen.findByTestId("clear-completed");
            expect(clearButton.getSensitive()).toBe(false);

            const checkbox = await screen.findByRole(AccessibleRole.CHECKBOX);
            await userEvent.click(checkbox);

            expect(clearButton.getSensitive()).toBe(true);
        });
    });

    describe("item count", () => {
        it("shows singular 'task' for one todo", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Single todo");

            const addButton = await screen.findByTestId("add-button");
            await userEvent.click(addButton);

            const itemsLeft = await screen.findByTestId("items-left");
            expect((itemsLeft as Label).getLabel()).toBe("1 task remaining");
        });

        it("shows plural 'tasks' for multiple todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            const addButton = await screen.findByTestId("add-button");

            await userEvent.type(input, "First");
            await userEvent.click(addButton);
            await userEvent.type(input, "Second");
            await userEvent.click(addButton);

            const itemsLeft = await screen.findByTestId("items-left");
            expect((itemsLeft as Label).getLabel()).toBe("2 tasks remaining");
        });

        it("shows plural 'tasks' for zero todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Todo");

            const addButton = await screen.findByTestId("add-button");
            await userEvent.click(addButton);

            const checkbox = await screen.findByRole(AccessibleRole.CHECKBOX);
            await userEvent.click(checkbox);

            const itemsLeft = await screen.findByTestId("items-left");
            expect((itemsLeft as Label).getLabel()).toBe("0 tasks remaining");
        });
    });

    describe("within scoped queries", () => {
        it("can query within a specific todo item", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            const addButton = await screen.findByTestId("add-button");

            await userEvent.type(input, "First");
            await userEvent.click(addButton);
            await userEvent.type(input, "Second");
            await userEvent.click(addButton);

            const todoItems = await screen.findAllByTestId(/^todo-\d+$/);
            expect(todoItems.length).toBeGreaterThanOrEqual(2);
            const firstTodoItem = todoItems[0] as Widget;
            const secondTodoItem = todoItems[1] as Widget;
            expect(firstTodoItem).toBeDefined();
            expect(secondTodoItem).toBeDefined();

            const { findByRole } = within(firstTodoItem);

            const checkbox = await findByRole(AccessibleRole.CHECKBOX);
            expect(checkbox).toBeDefined();

            const deleteBtn = await findByRole(AccessibleRole.BUTTON);
            expect(deleteBtn).toBeDefined();
        });
    });
});
