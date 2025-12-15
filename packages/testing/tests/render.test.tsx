import { AccessibleRole, Orientation } from "@gtkx/ffi/gtk";
import { ApplicationWindow, Box, Button, Label } from "@gtkx/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "../src/index.js";

describe("render", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("return value", () => {
        it("returns an object with container", async () => {
            const result = await render(<Label label="Test" />);

            expect(result.container).toBeDefined();
            expect(typeof result.container.getActiveWindow).toBe("function");
        });

        it("returns query functions", async () => {
            const result = await render(<Label label="Test" />);

            expect(typeof result.findByRole).toBe("function");
            expect(typeof result.findByText).toBe("function");
            expect(typeof result.findByLabelText).toBe("function");
            expect(typeof result.findAllByRole).toBe("function");
            expect(typeof result.findAllByText).toBe("function");
            expect(typeof result.findAllByLabelText).toBe("function");
        });

        it("returns unmount function", async () => {
            const result = await render(<Label label="Test" />);

            expect(typeof result.unmount).toBe("function");
        });

        it("returns rerender function", async () => {
            const result = await render(<Label label="Test" />);

            expect(typeof result.rerender).toBe("function");
        });

        it("returns debug function", async () => {
            const result = await render(<Label label="Test" />);

            expect(typeof result.debug).toBe("function");
        });
    });

    describe("bound queries", () => {
        it("findByRole finds element", async () => {
            const { findByRole } = await render(<Button label="Click me" />);

            const button = await findByRole(AccessibleRole.BUTTON, { name: "Click me" });
            expect(button).toBeDefined();
        });

        it("findByText finds element", async () => {
            const { findByText } = await render(<Label label="Hello World" />);

            const label = await findByText("Hello World");
            expect(label).toBeDefined();
        });

        it("findByLabelText finds element", async () => {
            const { findByLabelText } = await render(<Button label="Submit" />);

            const button = await findByLabelText("Submit");
            expect(button).toBeDefined();
        });

        it("findAllByRole finds multiple elements", async () => {
            const { findAllByRole } = await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Button label="One" />
                    <Button label="Two" />
                </Box>,
            );

            const buttons = await findAllByRole(AccessibleRole.BUTTON);
            expect(buttons.length).toBe(2);
        });
    });

    describe("rerender", () => {
        it("updates the rendered content", async () => {
            const { rerender, findByText } = await render(<Label label="Initial" />);

            await findByText("Initial");

            await rerender(<Label label="Updated" />);

            const label = await findByText("Updated");
            expect(label).toBeDefined();
        });

        it("preserves state when rerendering same component", async () => {
            let setCount: (n: number) => void = () => {};

            const Counter = () => {
                const [count, _setCount] = useState(0);
                setCount = _setCount;
                return <Label label={`Count: ${count}`} />;
            };

            const { findByText, rerender } = await render(<Counter />);

            await findByText("Count: 0");
            setCount(5);
            await findByText("Count: 5");

            await rerender(<Counter />);

            await findByText("Count: 5");
        });
    });

    describe("unmount", () => {
        it("removes rendered content", async () => {
            const { unmount, findByText } = await render(<Label label="Will be removed" />);

            await findByText("Will be removed");

            await unmount();

            await expect(findByText("Will be removed")).rejects.toThrow();
        });
    });

    describe("container", () => {
        it("provides access to application", async () => {
            const { container } = await render(<Label label="Test" />);

            const windows = container.getWindows();
            expect(windows.length).toBeGreaterThan(0);
        });

        it("provides access to active window", async () => {
            const { container, findAllByText } = await render(
                <ApplicationWindow title="Test Window">
                    <Label label="Window Content" />
                </ApplicationWindow>,
            );

            const labels = await findAllByText("Window Content");
            expect(labels.length).toBeGreaterThan(0);

            const activeWindow = container.getActiveWindow();
            expect(activeWindow).not.toBeNull();
        });
    });
});

describe("cleanup", () => {
    it("removes windows after cleanup", async () => {
        const { container, findByText } = await render(<Label label="Before cleanup" />);

        await findByText("Before cleanup");
        const windowsBefore = container.getWindows();
        expect(windowsBefore.length).toBeGreaterThan(0);

        await cleanup();

        const windowsAfter = container.getWindows();
        expect(windowsAfter.length).toBe(0);
    });

    it("allows rendering again after cleanup", async () => {
        await render(<Label label="First render" />);

        await cleanup();

        const { findByText } = await render(<Label label="Second render" />);

        const label = await findByText("Second render");
        expect(label).toBeDefined();
    });
});

describe("multiple renders", () => {
    afterEach(async () => {
        await cleanup();
    });

    it("subsequent renders update the same container", async () => {
        const result1 = await render(<Label label="First" />);

        const result2 = await render(<Label label="Second" />);

        expect(result1.container).toBe(result2.container);
    });

    it("can render complex nested components", async () => {
        const { findByRole, findByText } = await render(
            <Box spacing={10} orientation={Orientation.VERTICAL}>
                <Label label="Header" />
                <Box spacing={5} orientation={Orientation.HORIZONTAL}>
                    <Button label="Action 1" />
                    <Button label="Action 2" />
                </Box>
                <Label label="Footer" />
            </Box>,
        );

        await findByText("Header");
        await findByText("Footer");
        await findByRole(AccessibleRole.BUTTON, { name: "Action 1" });
        await findByRole(AccessibleRole.BUTTON, { name: "Action 2" });
    });
});
