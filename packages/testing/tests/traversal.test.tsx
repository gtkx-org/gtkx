import { AccessibleRole, Orientation, type Window } from "@gtkx/ffi/gtk";
import { ApplicationWindow, Box, Button, Label } from "@gtkx/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "../src/index.js";
import { findAll } from "../src/traversal.js";

describe("findAll", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("with Application container", () => {
        it("finds all widgets matching predicate", async () => {
            const { container } = await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Button label="Button 1" />
                    <Button label="Button 2" />
                    <Label label="Not a button" />
                </Box>,
            );

            const buttons = findAll(container, (node) => {
                return node.getAccessibleRole() === AccessibleRole.BUTTON;
            });

            // Should find at least 2 buttons (our explicit ones, plus GTK may add internal buttons)
            expect(buttons.length).toBeGreaterThanOrEqual(2);
        });

        it("returns empty array when no widgets with MENU role exist", async () => {
            const { container } = await render(<Label label="Just a label" />);

            const menus = findAll(container, (node) => {
                return node.getAccessibleRole() === AccessibleRole.MENU;
            });

            expect(menus).toEqual([]);
        });

        it("finds widgets in nested hierarchy", async () => {
            const { container } = await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Box spacing={0} orientation={Orientation.HORIZONTAL}>
                        <Button label="Deep Button" />
                    </Box>
                </Box>,
            );

            const buttons = findAll(container, (node) => {
                return node.getAccessibleRole() === AccessibleRole.BUTTON;
            });

            // At least 1 button (GTK may create additional internal buttons)
            expect(buttons.length).toBeGreaterThanOrEqual(1);
        });

        it("traverses multiple windows", async () => {
            const { container } = await render(
                <>
                    <ApplicationWindow>
                        <Button label="Window 1 Button" />
                    </ApplicationWindow>
                    <ApplicationWindow>
                        <Button label="Window 2 Button" />
                    </ApplicationWindow>
                </>,
                { wrapper: false },
            );

            const windows = findAll(container, (node) => {
                return node.getAccessibleRole() === AccessibleRole.WINDOW;
            });

            expect(windows.length).toBeGreaterThanOrEqual(2);
        });

        it("returns all widgets when predicate always returns true", async () => {
            const { container } = await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Label label="Label" />
                    <Button label="Button" />
                </Box>,
            );

            const activeWindow = container.getActiveWindow();
            expect(activeWindow).not.toBeNull();

            const allWidgets = findAll(activeWindow as Window, () => true);

            expect(allWidgets.length).toBeGreaterThan(0);
        });
    });

    describe("with Widget container", () => {
        it("finds widgets starting from a specific widget", async () => {
            await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Button label="Outside" />
                    <Box spacing={0} orientation={Orientation.HORIZONTAL}>
                        <Button label="Inside 1" />
                        <Button label="Inside 2" />
                    </Box>
                </Box>,
            );

            const { container } = await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Label label="Start here" />
                    <Button label="Child button" />
                </Box>,
            );

            const activeWindow = container.getActiveWindow();
            expect(activeWindow).not.toBeNull();

            const labels = findAll(activeWindow as Window, (node) => {
                return node.getAccessibleRole() === AccessibleRole.LABEL;
            });

            expect(labels.length).toBeGreaterThan(0);
        });
    });

    describe("predicate behavior", () => {
        it("passes each widget to predicate", async () => {
            const visitedRoles: AccessibleRole[] = [];

            const { container } = await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Label label="Label" />
                    <Button label="Button" />
                </Box>,
            );

            findAll(container, (node) => {
                visitedRoles.push(node.getAccessibleRole());
                return false;
            });

            expect(visitedRoles.length).toBeGreaterThan(0);
            expect(visitedRoles).toContain(AccessibleRole.WINDOW);
        });

        it("can match by custom criteria", async () => {
            const { container } = await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Label label="First Label" />
                    <Label label="Second Label" />
                    <Button label="Button" />
                </Box>,
            );

            const labels = findAll(container, (node) => {
                return node.getAccessibleRole() === AccessibleRole.LABEL;
            });

            // Should find at least the 2 explicit labels (may include button's internal label)
            expect(labels.length).toBeGreaterThanOrEqual(2);
        });
    });
});
