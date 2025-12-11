import { getInterface } from "@gtkx/ffi";
import { AccessibleRole, type CheckButton, Editable, type Label } from "@gtkx/ffi/gtk";
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

            const title = await screen.findByRole(AccessibleRole.LABEL, { name: "Todo App" });
            expect(title).toBeDefined();
        });

        it("shows empty message when no todos", async () => {
            await render(<App />, { wrapper: false });

            const emptyMessage = await screen.findByText("No todos to display");
            expect(emptyMessage).toBeDefined();
        });

        it("has an input field for new todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            expect(input).toBeDefined();
        });

        it("has an add button", async () => {
            await render(<App />, { wrapper: false });

            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });
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

            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });
            await userEvent.click(addButton);

            const todoText = await screen.findByText("Buy groceries");
            expect(todoText).toBeDefined();
        });

        it("clears input after adding todo", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Buy groceries");

            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });
            await userEvent.click(addButton);

            await waitFor(() => {
                const currentText = getInterface(input, Editable)?.getText() ?? "";
                if (currentText !== "") throw new Error("Input not cleared");
            });
        });

        it("can add multiple todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });

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

            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });
            await userEvent.click(addButton);

            const emptyMessage = await screen.findByText("No todos to display");
            expect(emptyMessage).toBeDefined();
        });

        it("does not add whitespace-only todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "   ");

            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });
            await userEvent.click(addButton);

            const emptyMessage = await screen.findByText("No todos to display");
            expect(emptyMessage).toBeDefined();
        });

        it("shows filters after adding first todo", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "New todo");

            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });
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

            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });
            await userEvent.click(addButton);

            const checkbox = await screen.findByRole(AccessibleRole.CHECKBOX);
            await userEvent.click(checkbox);

            expect((checkbox as CheckButton).getActive()).toBe(true);
        });

        it("can toggle a completed todo back to active", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Test todo");

            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });
            await userEvent.click(addButton);

            const checkbox = await screen.findByRole(AccessibleRole.CHECKBOX);
            await userEvent.click(checkbox);
            await userEvent.click(checkbox);

            expect((checkbox as CheckButton).getActive()).toBe(false);
        });

        it("updates item count when completing todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });

            await userEvent.type(input, "Todo 1");
            await userEvent.click(addButton);
            await userEvent.type(input, "Todo 2");
            await userEvent.click(addButton);

            let itemsLeft = await screen.findByTestId("items-left");
            expect((itemsLeft as Label).getLabel()).toContain("2");

            const checkboxes = await screen.findAllByRole(AccessibleRole.CHECKBOX);
            const firstCheckbox = checkboxes[0];
            if (!firstCheckbox) throw new Error("Expected at least one checkbox");
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

            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });
            await userEvent.click(addButton);

            const todoText = await screen.findByText("Todo to delete");
            expect(todoText).toBeDefined();

            const deleteButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Delete" });
            await userEvent.click(deleteButton);

            const emptyMessage = await screen.findByText("No todos to display");
            expect(emptyMessage).toBeDefined();
        });

        it("deletes only the targeted todo", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });

            await userEvent.type(input, "Keep this");
            await userEvent.click(addButton);
            await userEvent.type(input, "Delete this");
            await userEvent.click(addButton);

            const deleteButtons = await screen.findAllByRole(AccessibleRole.BUTTON, { name: "Delete" });
            const secondDeleteButton = deleteButtons[1];
            if (!secondDeleteButton) throw new Error("Expected at least two delete buttons");
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
            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });

            await userEvent.type(input, "Active todo");
            await userEvent.click(addButton);
            await userEvent.type(input, "Completed todo");
            await userEvent.click(addButton);

            const checkboxes = await screen.findAllByRole(AccessibleRole.CHECKBOX);
            const secondCheckbox = checkboxes[1];
            if (!secondCheckbox) throw new Error("Expected at least two checkboxes");
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

        it("disables the active filter button", async () => {
            await setupTodosWithMixedState();

            const filterAll = await screen.findByTestId("filter-all");
            expect(filterAll.getSensitive()).toBe(false);

            const filterActive = await screen.findByTestId("filter-active");
            await userEvent.click(filterActive);

            expect(filterActive.getSensitive()).toBe(false);
            expect(filterAll.getSensitive()).toBe(true);
        });
    });

    describe("clear completed", () => {
        it("removes all completed todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });

            await userEvent.type(input, "Keep active");
            await userEvent.click(addButton);
            await userEvent.type(input, "Complete me");
            await userEvent.click(addButton);
            await userEvent.type(input, "Also complete");
            await userEvent.click(addButton);

            const checkboxes = await screen.findAllByRole(AccessibleRole.CHECKBOX);
            const secondCheckbox = checkboxes[1];
            const thirdCheckbox = checkboxes[2];
            if (!secondCheckbox || !thirdCheckbox) throw new Error("Expected at least three checkboxes");
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

            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });
            await userEvent.click(addButton);

            const clearButton = await screen.findByTestId("clear-completed");
            expect(clearButton.getSensitive()).toBe(false);
        });

        it("becomes enabled when a todo is completed", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Todo");

            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });
            await userEvent.click(addButton);

            const clearButton = await screen.findByTestId("clear-completed");
            expect(clearButton.getSensitive()).toBe(false);

            const checkbox = await screen.findByRole(AccessibleRole.CHECKBOX);
            await userEvent.click(checkbox);

            expect(clearButton.getSensitive()).toBe(true);
        });
    });

    describe("item count", () => {
        it("shows singular 'item' for one todo", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Single todo");

            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });
            await userEvent.click(addButton);

            const itemsLeft = await screen.findByTestId("items-left");
            expect((itemsLeft as Label).getLabel()).toBe("1 item left");
        });

        it("shows plural 'items' for multiple todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });

            await userEvent.type(input, "First");
            await userEvent.click(addButton);
            await userEvent.type(input, "Second");
            await userEvent.click(addButton);

            const itemsLeft = await screen.findByTestId("items-left");
            expect((itemsLeft as Label).getLabel()).toBe("2 items left");
        });

        it("shows plural 'items' for zero todos", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            await userEvent.type(input, "Todo");

            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });
            await userEvent.click(addButton);

            const checkbox = await screen.findByRole(AccessibleRole.CHECKBOX);
            await userEvent.click(checkbox);

            const itemsLeft = await screen.findByTestId("items-left");
            expect((itemsLeft as Label).getLabel()).toBe("0 items left");
        });
    });

    describe("within scoped queries", () => {
        it("can query within a specific todo item", async () => {
            await render(<App />, { wrapper: false });

            const input = await screen.findByTestId("todo-input");
            const addButton = await screen.findByRole(AccessibleRole.BUTTON, { name: "Add" });

            await userEvent.type(input, "First");
            await userEvent.click(addButton);
            await userEvent.type(input, "Second");
            await userEvent.click(addButton);

            const todoItems = await screen.findAllByTestId(/^todo-\d+$/);
            const firstTodoItem = todoItems[0];
            const secondTodoItem = todoItems[1];
            if (!firstTodoItem || !secondTodoItem) throw new Error("Expected at least two todo items");

            const { findByRole } = within(firstTodoItem);

            const checkbox = await findByRole(AccessibleRole.CHECKBOX);
            expect(checkbox).toBeDefined();

            const deleteBtn = await findByRole(AccessibleRole.BUTTON);
            expect(deleteBtn).toBeDefined();
        });
    });
});
