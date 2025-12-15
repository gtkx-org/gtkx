import { AccessibleRole, Orientation } from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "../src/index.js";
import { findAllByTestId, findByTestId } from "../src/queries.js";

describe("Queries", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("findByRole", () => {
        it("finds a button by role", async () => {
            await render(<Button label="Click me" />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Click me" });
            expect(button).toBeDefined();
        });

        it("finds a button by role and name", async () => {
            await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Button label="First" />
                    <Button label="Second" />
                </Box>,
            );

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Second" });
            expect(button).toBeDefined();
        });

        it("throws when element not found", async () => {
            await render(<Label label="No buttons here" />);

            await expect(screen.findByRole(AccessibleRole.BUTTON, { name: "NonExistent" })).rejects.toThrow(
                /Unable to find any elements with role/,
            );
        });

        it("throws when multiple elements found", async () => {
            await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Button label="Same" />
                    <Button label="Same" />
                </Box>,
            );

            await expect(screen.findByRole(AccessibleRole.BUTTON, { name: "Same" })).rejects.toThrow(
                /Found \d+ elements/,
            );
        });
    });

    describe("findAllByRole", () => {
        it("returns all matching elements with name filter", async () => {
            await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Button label="Action" />
                    <Button label="Action" />
                    <Button label="Action" />
                    <Button label="Different" />
                </Box>,
            );

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON, { name: "Action" });
            expect(buttons.length).toBe(3);
        });

        it("throws when no elements match name filter", async () => {
            await render(<Button label="Existing" />);

            await expect(screen.findAllByRole(AccessibleRole.BUTTON, { name: "NonExistent" })).rejects.toThrow(
                /Unable to find any elements/,
            );
        });
    });

    describe("findByText", () => {
        it("finds element by text content", async () => {
            await render(<Label label="Hello World" />);

            const label = await screen.findByText("Hello World");
            expect(label).toBeDefined();
        });

        it("finds element by regex", async () => {
            await render(<Label label="Hello World" />);

            const label = await screen.findByText(/Hello/);
            expect(label).toBeDefined();
        });

        it("throws when text not found", async () => {
            await render(<Label label="Different" />);

            await expect(screen.findByText("NotFound")).rejects.toThrow(/Unable to find any elements with text/);
        });
    });

    describe("findAllByText", () => {
        it("returns all matching elements", async () => {
            await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Label label="Same" />
                    <Label label="Same" />
                </Box>,
            );

            const labels = await screen.findAllByText("Same");
            expect(labels.length).toBe(2);
        });
    });

    describe("findByLabelText", () => {
        it("finds element by label", async () => {
            await render(<Button label="Submit" />);

            const button = await screen.findByLabelText("Submit");
            expect(button).toBeDefined();
        });

        it("throws when label not found", async () => {
            await render(<Button label="Different" />);

            await expect(screen.findByLabelText("NotFound")).rejects.toThrow(/Unable to find any elements/);
        });
    });

    describe("findAllByLabelText", () => {
        it("returns all matching elements", async () => {
            await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Button label="Action" />
                    <Button label="Action" />
                </Box>,
            );

            const buttons = await screen.findAllByLabelText("Action");
            expect(buttons.length).toBe(2);
        });
    });

    describe("render result queries", () => {
        it("returns bound queries from render", async () => {
            const { findByRole, findByText } = await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Button label="Click" />
                    <Label label="Text" />
                </Box>,
            );

            expect(await findByRole(AccessibleRole.BUTTON, { name: "Click" })).toBeDefined();
            expect(await findByText("Text")).toBeDefined();
        });
    });

    describe("findByTestId", () => {
        it("finds element by test id (widget name)", async () => {
            const { container } = await render(<Button label="Test" name="test-button" />);

            const button = await findByTestId(container, "test-button");
            expect(button).toBeDefined();
        });

        it("throws when test id not found", async () => {
            const { container } = await render(<Button label="Test" />);

            await expect(findByTestId(container, "nonexistent")).rejects.toThrow(
                /Unable to find any elements with test id/,
            );
        });
    });

    describe("findAllByTestId", () => {
        it("finds all elements by test id asynchronously", async () => {
            const { container } = await render(
                <Box spacing={0} orientation={Orientation.VERTICAL}>
                    <Button label="One" name="item" />
                    <Button label="Two" name="item" />
                </Box>,
            );

            const buttons = await findAllByTestId(container, "item");
            expect(buttons.length).toBe(2);
        });

        it("throws when no elements found", async () => {
            const { container } = await render(<Button label="Test" />);

            await expect(findAllByTestId(container, "nonexistent")).rejects.toThrow(
                /Unable to find any elements with test id/,
            );
        });
    });

    describe("TextMatchOptions", () => {
        it("supports exact: false for partial matching", async () => {
            await render(<Label label="Hello World" />);

            const result = await screen.findByText("Hello", { exact: false });
            expect(result).toBeDefined();
        });

        it("supports exact: true (default) for exact matching", async () => {
            await render(<Label label="Hello World" />);

            await expect(screen.findByText("Hello", { exact: true })).rejects.toThrow(/Unable to find any elements/);
        });

        it("supports custom normalizer", async () => {
            await render(<Label label="  Spaced  Text  " />);

            const result = await screen.findByText("Spaced Text", {
                normalizer: (text) => text.trim().replace(/\s+/g, " "),
            });
            expect(result).toBeDefined();
        });

        it("supports regex matching", async () => {
            await render(<Label label="Count: 42" />);

            const result = await screen.findByText(/Count: \d+/);
            expect(result).toBeDefined();
        });

        it("supports function matcher", async () => {
            await render(<Label label="Hello World" />);

            const result = await screen.findByText((content) => content.startsWith("Hello"));
            expect(result).toBeDefined();
        });

        it("function matcher receives normalized text", async () => {
            await render(<Label label="  Spaced  Text  " />);

            const result = await screen.findByText((content) => content === "Spaced Text");
            expect(result).toBeDefined();
        });

        it("supports trim: false to preserve leading/trailing whitespace", async () => {
            await render(<Label label="  Hello  " />);

            await expect(screen.findByText("Hello", { trim: false })).rejects.toThrow(/Unable to find any elements/);
        });

        it("supports collapseWhitespace: false to preserve multiple spaces", async () => {
            await render(<Label label="Hello   World" />);

            await expect(screen.findByText("Hello World", { collapseWhitespace: false })).rejects.toThrow(
                /Unable to find any elements/,
            );
        });

        it("trims and collapses whitespace by default", async () => {
            await render(<Label label="  Hello   World  " />);

            const result = await screen.findByText("Hello World");
            expect(result).toBeDefined();
        });
    });

    describe("findByRole with function name matcher", () => {
        it("supports function matcher for name option", async () => {
            await render(<Button label="Click Me" />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, {
                name: (content) => content.includes("Click"),
            });
            expect(button).toBeDefined();
        });

        it("function matcher receives normalized text", async () => {
            await render(<Button label="  Click  Me  " />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, {
                name: (content) => content === "Click Me",
            });
            expect(button).toBeDefined();
        });
    });
});
