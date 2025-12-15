import { AccessibleRole, Orientation } from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitForElementToBeRemoved } from "../src/index.js";

describe("waitForElementToBeRemoved", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("element removal with state changes", () => {
        it("resolves when element is removed via state update", async () => {
            let hideLabel: () => void = () => {};

            const TestComponent = () => {
                const [showLabel, setShowLabel] = useState(true);
                hideLabel = () => setShowLabel(false);

                return (
                    <Box spacing={0} orientation={Orientation.VERTICAL}>
                        {showLabel && <Label label="Removable" />}
                        <Button label="Keep" />
                    </Box>
                );
            };

            await render(<TestComponent />);

            const label = await screen.findByText("Removable");

            setTimeout(() => {
                hideLabel();
            }, 50);

            await waitForElementToBeRemoved(label, { timeout: 500, interval: 20 });

            await expect(screen.findByText("Removable")).rejects.toThrow();
        });

        it("resolves when element is removed using callback", async () => {
            let hideButton: () => void = () => {};

            const TestComponent = () => {
                const [showButton, setShowButton] = useState(true);
                hideButton = () => setShowButton(false);

                return (
                    <Box spacing={0} orientation={Orientation.VERTICAL}>
                        {showButton && <Button label="ToRemove" />}
                        <Label label="Static" />
                    </Box>
                );
            };

            await render(<TestComponent />);

            const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "ToRemove" });

            setTimeout(() => {
                hideButton();
            }, 50);

            await waitForElementToBeRemoved(button, {
                timeout: 500,
                interval: 20,
            });

            await expect(screen.findByRole(AccessibleRole.BUTTON, { name: "ToRemove" })).rejects.toThrow();
        });
    });

    describe("error cases", () => {
        it("throws when element is not removed before timeout", async () => {
            await render(<Label label="Permanent" />);

            const label = await screen.findByText("Permanent");

            await expect(waitForElementToBeRemoved(label, { timeout: 100, interval: 20 })).rejects.toThrow(
                /Timed out after 100ms waiting for element to be removed/,
            );
        });
    });

    describe("options handling", () => {
        it("uses custom timeout", async () => {
            await render(<Label label="Stays" />);

            const label = await screen.findByText("Stays");
            const start = Date.now();

            await expect(waitForElementToBeRemoved(label, { timeout: 150, interval: 30 })).rejects.toThrow();

            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(140);
            expect(elapsed).toBeLessThan(300);
        });

        it("calls onTimeout when provided", async () => {
            await render(<Label label="Timeout Test" />);

            const label = await screen.findByText("Timeout Test");
            const customError = new Error("Custom timeout error");

            await expect(
                waitForElementToBeRemoved(label, {
                    timeout: 100,
                    interval: 20,
                    onTimeout: () => customError,
                }),
            ).rejects.toThrow("Custom timeout error");
        });
    });
});
