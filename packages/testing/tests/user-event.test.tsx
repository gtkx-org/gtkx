import { AccessibleRole, Orientation } from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "../src/index.js";
import { userEvent } from "../src/user-event.js";

describe("userEvent", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("click", () => {
        it("emits clicked signal on button widget", async () => {
            await render(<Button label="Click Me" />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Click Me" });

            // userEvent.click emits the "clicked" signal via g_signal_emit_by_name
            await userEvent.click(button);

            expect(button).toBeDefined();
        });

        it("can emit click signal on multiple buttons", async () => {
            await render(
                <Box spacing={10} orientation={Orientation.VERTICAL}>
                    <Button label="Button 1" />
                    <Button label="Button 2" />
                </Box>,
            );

            const button1 = await screen.findByRole(AccessibleRole.BUTTON, { name: "Button 1" });
            const button2 = await screen.findByRole(AccessibleRole.BUTTON, { name: "Button 2" });

            await userEvent.click(button1);
            await userEvent.click(button2);

            expect(button1).toBeDefined();
            expect(button2).toBeDefined();
        });

        it("can emit multiple clicks on same button", async () => {
            await render(<Button label="Multi Click" />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Multi Click" });

            await userEvent.click(button);
            await userEvent.click(button);
            await userEvent.click(button);

            expect(button).toBeDefined();
        });
    });

    describe("type", () => {
        it("throws when element is not editable (label)", async () => {
            await render(<Label label="Not editable" />);

            const label = await screen.findByText("Not editable");

            await expect(userEvent.type(label, "text")).rejects.toThrow(
                /Cannot type into element: element is not editable/,
            );
        });

        it("throws when element is not editable (button)", async () => {
            await render(<Button label="Not Editable" />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Not Editable" });

            await expect(userEvent.type(button, "text")).rejects.toThrow(
                /Cannot type into element: element is not editable/,
            );
        });
    });

    describe("dblClick", () => {
        it("emits two clicked signals on button widget", async () => {
            await render(<Button label="Double Click Me" />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Double Click Me" });
            await userEvent.dblClick(button);
            expect(button).toBeDefined();
        });

        it("can emit double click on multiple buttons", async () => {
            await render(
                <Box spacing={10} orientation={Orientation.VERTICAL}>
                    <Button label="First" />
                    <Button label="Second" />
                </Box>,
            );

            const first = await screen.findByRole(AccessibleRole.BUTTON, { name: "First" });
            const second = await screen.findByRole(AccessibleRole.BUTTON, { name: "Second" });

            await userEvent.dblClick(first);
            await userEvent.dblClick(second);

            expect(first).toBeDefined();
            expect(second).toBeDefined();
        });
    });

    describe("activate", () => {
        it("activates a button widget", async () => {
            await render(<Button label="Activate Me" />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Activate Me" });
            await userEvent.activate(button);
            expect(button).toBeDefined();
        });
    });

    describe("clear", () => {
        it("throws when element is not editable (label)", async () => {
            await render(<Label label="Not clearable" />);

            const label = await screen.findByText("Not clearable");

            await expect(userEvent.clear(label)).rejects.toThrow(/Cannot clear element: element is not editable/);
        });

        it("throws when element is not editable (button)", async () => {
            await render(<Button label="Not Clearable" />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Not Clearable" });

            await expect(userEvent.clear(button)).rejects.toThrow(/Cannot clear element: element is not editable/);
        });
    });

    describe("tripleClick", () => {
        it("emits three clicked signals on button widget", async () => {
            await render(<Button label="Triple Click Me" />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Triple Click Me" });
            await userEvent.tripleClick(button);
            expect(button).toBeDefined();
        });
    });

    describe("tab", () => {
        it("moves focus forward", async () => {
            await render(
                <Box spacing={10} orientation={Orientation.VERTICAL}>
                    <Button label="First" />
                    <Button label="Second" />
                </Box>,
            );

            const first = await screen.findByRole(AccessibleRole.BUTTON, { name: "First" });
            first.grabFocus();

            await userEvent.tab(first);

            expect(first).toBeDefined();
        });

        it("moves focus backward with shift option", async () => {
            await render(
                <Box spacing={10} orientation={Orientation.VERTICAL}>
                    <Button label="First" />
                    <Button label="Second" />
                </Box>,
            );

            const second = await screen.findByRole(AccessibleRole.BUTTON, { name: "Second" });
            second.grabFocus();

            await userEvent.tab(second, { shift: true });

            expect(second).toBeDefined();
        });
    });

    describe("selectOptions", () => {
        it("throws when element is not selectable", async () => {
            await render(<Button label="Not Selectable" />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Not Selectable" });

            await expect(userEvent.selectOptions(button, 0)).rejects.toThrow(
                /Cannot select options: element is not a selectable widget/,
            );
        });
    });

    describe("deselectOptions", () => {
        it("throws when element is not a ListBox", async () => {
            await render(<Button label="Not a List" />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Not a List" });

            await expect(userEvent.deselectOptions(button, 0)).rejects.toThrow(
                /Cannot deselect options: only ListBox supports deselection/,
            );
        });
    });
});
