import { AccessibleRole, Orientation } from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "../src/index.js";
import { screen, setScreenRoot } from "../src/screen.js";

describe("screen", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("before render", () => {
        it("findByRole throws when no render has been performed", async () => {
            setScreenRoot(null);

            await expect(Promise.resolve().then(() => screen.findByRole(AccessibleRole.BUTTON))).rejects.toThrow(
                /No render has been performed. Call render\(\) before using screen queries/,
            );
        });

        it("findByText throws when no render has been performed", async () => {
            setScreenRoot(null);

            await expect(Promise.resolve().then(() => screen.findByText("test"))).rejects.toThrow(
                /No render has been performed. Call render\(\) before using screen queries/,
            );
        });

        it("findByLabelText throws when no render has been performed", async () => {
            setScreenRoot(null);

            await expect(Promise.resolve().then(() => screen.findByLabelText("test"))).rejects.toThrow(
                /No render has been performed. Call render\(\) before using screen queries/,
            );
        });
    });

    describe("after render", () => {
        it("findByRole finds elements", async () => {
            await render(<Button label="Test Button" />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Test Button" });
            expect(button).toBeDefined();
        });

        it("findByText finds elements", async () => {
            await render(<Label label="Hello World" />);

            const label = await screen.findByText("Hello World");
            expect(label).toBeDefined();
        });

        it("findByLabelText finds elements", async () => {
            await render(<Button label="Submit" />);

            const button = await screen.findByLabelText("Submit");
            expect(button).toBeDefined();
        });

        it("findAllByRole finds multiple elements", async () => {
            await render(
                <Box spacing={10} orientation={Orientation.VERTICAL}>
                    <Button label="First" />
                    <Button label="Second" />
                </Box>,
            );

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON);
            expect(buttons.length).toBe(2);
        });
    });

    describe("query options", () => {
        it("findByRole with name option filters results", async () => {
            await render(
                <Box spacing={10} orientation={Orientation.VERTICAL}>
                    <Button label="First" />
                    <Button label="Second" />
                </Box>,
            );

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Second" });
            expect(button).toBeDefined();
        });

        it("findByText with regex matches partial text", async () => {
            await render(<Label label="Welcome to the application" />);

            const label = await screen.findByText(/Welcome/);
            expect(label).toBeDefined();
        });

        it("findByLabelText with regex matches partial label", async () => {
            await render(<Button label="Submit Form" />);

            const button = await screen.findByLabelText(/Submit/);
            expect(button).toBeDefined();
        });
    });

    describe("error cases", () => {
        it("findByRole throws when element not found with name filter", async () => {
            await render(<Label label="No buttons here" />);

            await expect(screen.findByRole(AccessibleRole.BUTTON, { name: "Nonexistent Button" })).rejects.toThrow(
                /Unable to find any elements with role/,
            );
        });

        it("findByText throws when text not found", async () => {
            await render(<Label label="Different text" />);

            await expect(screen.findByText("Nonexistent")).rejects.toThrow(/Unable to find any elements with text/);
        });

        it("findByRole throws when multiple elements match without name filter", async () => {
            await render(
                <Box spacing={10} orientation={Orientation.VERTICAL}>
                    <Button label="First" />
                    <Button label="Second" />
                </Box>,
            );

            await expect(screen.findByRole(AccessibleRole.BUTTON)).rejects.toThrow(/Found \d+ elements with role/);
        });
    });
});

describe("setScreenRoot", () => {
    afterEach(async () => {
        await cleanup();
    });

    it("allows setting root to null", async () => {
        await render(<Label label="Test" />);

        setScreenRoot(null);

        await expect(Promise.resolve().then(() => screen.findByText("Test"))).rejects.toThrow(
            /No render has been performed/,
        );
    });

    it("allows setting root to application", async () => {
        const { container } = await render(<Label label="Test Label" />);

        setScreenRoot(null);
        setScreenRoot(container);

        const label = await screen.findByText("Test Label");
        expect(label).toBeDefined();
    });
});
