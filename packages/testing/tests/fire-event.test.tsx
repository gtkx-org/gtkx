import { AccessibleRole, Orientation } from "@gtkx/ffi/gtk";
import { Box, Button } from "@gtkx/react";
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent } from "../src/fire-event.js";
import { cleanup, render, screen } from "../src/index.js";

describe("fireEvent", () => {
    afterEach(async () => {
        await cleanup();
    });

    it("emits signal by name on widget", async () => {
        await render(<Button label="Test Button" />);

        const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Test Button" });
        await fireEvent(button, "clicked");
        expect(button).toBeDefined();
    });

    it("can emit signals on multiple widgets", async () => {
        await render(
            <Box spacing={10} orientation={Orientation.VERTICAL}>
                <Button label="First" />
                <Button label="Second" />
            </Box>,
        );

        const first = await screen.findByRole(AccessibleRole.BUTTON, { name: "First" });
        const second = await screen.findByRole(AccessibleRole.BUTTON, { name: "Second" });

        await fireEvent(first, "clicked");
        await fireEvent(second, "clicked");

        expect(first).toBeDefined();
        expect(second).toBeDefined();
    });
});
