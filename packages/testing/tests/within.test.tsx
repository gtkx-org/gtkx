import { AccessibleRole, Orientation } from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "../src/index.js";

const V = Orientation.VERTICAL;

describe("within", () => {
    afterEach(async () => {
        await cleanup();
    });

    it("scopes queries to a container widget", async () => {
        await render(
            <Box spacing={0} orientation={V} name="outer">
                <Box spacing={0} orientation={V} name="container">
                    <Label label="Inside" />
                </Box>
                <Label label="Outside" />
            </Box>,
        );

        const container = await screen.findByTestId("container");
        const { findByText } = within(container);

        const inside = await findByText("Inside");
        expect(inside).toBeDefined();
    });

    it("only finds elements within the container, not outside", async () => {
        await render(
            <Box spacing={0} orientation={V} name="outer">
                <Box spacing={0} orientation={V} name="container">
                    <Label label="Shared" />
                </Box>
                <Label label="Shared" />
            </Box>,
        );

        const allLabels = await screen.findAllByText("Shared");
        expect(allLabels).toHaveLength(2);

        const container = await screen.findByTestId("container");
        const { findAllByText } = within(container);

        const containerLabels = await findAllByText("Shared");
        expect(containerLabels).toHaveLength(1);
    });

    it("finds elements by role within container", async () => {
        await render(
            <Box spacing={0} orientation={V} name="outer">
                <Box spacing={0} orientation={V} name="container">
                    <Button label="Inner Button" />
                </Box>
                <Button label="Outer Button" />
            </Box>,
        );

        const container = await screen.findByTestId("container");
        const { findByRole } = within(container);

        const button = await findByRole(AccessibleRole.BUTTON);
        expect(button).toBeDefined();
    });

    it("finds elements by label text within container", async () => {
        await render(
            <Box spacing={0} orientation={V} name="outer">
                <Box spacing={0} orientation={V} name="container">
                    <Button label="Target" />
                </Box>
                <Button label="Other" />
            </Box>,
        );

        const container = await screen.findByTestId("container");
        const { findByLabelText } = within(container);

        const button = await findByLabelText("Target");
        expect(button).toBeDefined();
    });

    it("finds elements by test id within container", async () => {
        await render(
            <Box spacing={0} orientation={V} name="outer">
                <Box spacing={0} orientation={V} name="container">
                    <Label label="Target" name="target-label" />
                </Box>
                <Label label="Other" name="other-label" />
            </Box>,
        );

        const container = await screen.findByTestId("container");
        const { findByTestId } = within(container);

        const label = await findByTestId("target-label");
        expect(label).toBeDefined();
    });

    it("finds all elements by role within container", async () => {
        await render(
            <Box spacing={0} orientation={V} name="outer">
                <Box spacing={0} orientation={V} name="container">
                    <Button label="Button 1" />
                    <Button label="Button 2" />
                </Box>
                <Button label="Outer Button" />
            </Box>,
        );

        const container = await screen.findByTestId("container");
        const { findAllByRole } = within(container);

        const buttons = await findAllByRole(AccessibleRole.BUTTON);
        expect(buttons).toHaveLength(2);
    });

    it("finds all elements by text within container", async () => {
        await render(
            <Box spacing={0} orientation={V} name="outer">
                <Box spacing={0} orientation={V} name="container">
                    <Label label="Item" />
                    <Label label="Item" />
                </Box>
                <Label label="Item" />
            </Box>,
        );

        const container = await screen.findByTestId("container");
        const { findAllByText } = within(container);

        const labels = await findAllByText("Item");
        expect(labels).toHaveLength(2);
    });

    it("finds all elements by label text within container", async () => {
        await render(
            <Box spacing={0} orientation={V} name="outer">
                <Box spacing={0} orientation={V} name="container">
                    <Button label="Click" />
                    <Button label="Click" />
                </Box>
                <Button label="Click" />
            </Box>,
        );

        const container = await screen.findByTestId("container");
        const { findAllByLabelText } = within(container);

        const buttons = await findAllByLabelText("Click");
        expect(buttons).toHaveLength(2);
    });

    it("finds all elements by test id within container", async () => {
        await render(
            <Box spacing={0} orientation={V} name="outer">
                <Box spacing={0} orientation={V} name="container">
                    <Label label="A" name="item" />
                    <Label label="B" name="item" />
                </Box>
                <Label label="C" name="item" />
            </Box>,
        );

        const container = await screen.findByTestId("container");
        const { findAllByTestId } = within(container);

        const labels = await findAllByTestId("item");
        expect(labels).toHaveLength(2);
    });

    it("supports nested within calls", async () => {
        await render(
            <Box spacing={0} orientation={V} name="outer">
                <Box spacing={0} orientation={V} name="level1">
                    <Box spacing={0} orientation={V} name="level2">
                        <Label label="Deep" />
                    </Box>
                </Box>
            </Box>,
        );

        const level1 = await screen.findByTestId("level1");
        const { findByTestId } = within(level1);

        const level2 = await findByTestId("level2");
        const { findByText } = within(level2);

        const label = await findByText("Deep");
        expect(label).toBeDefined();
    });

    it("uses text match options", async () => {
        await render(
            <Box spacing={0} orientation={V} name="container">
                <Label label="Hello World" />
            </Box>,
        );

        const container = await screen.findByTestId("container");
        const { findByText } = within(container);

        const labelExact = await findByText("Hello World");
        expect(labelExact).toBeDefined();

        const labelPartial = await findByText("Hello", { exact: false });
        expect(labelPartial).toBeDefined();
    });

    it("uses by role options", async () => {
        await render(
            <Box spacing={0} orientation={V} name="container">
                <Button label="Enabled" />
                <Button label="Disabled" sensitive={false} />
            </Box>,
        );

        const container = await screen.findByTestId("container");
        const { findByRole } = within(container);

        const enabledButton = await findByRole(AccessibleRole.BUTTON, { name: "Enabled" });
        expect(enabledButton).toBeDefined();

        const disabledButton = await findByRole(AccessibleRole.BUTTON, { name: "Disabled" });
        expect(disabledButton).toBeDefined();
    });
});
