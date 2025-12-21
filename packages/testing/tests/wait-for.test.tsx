import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, userEvent, waitFor, waitForElementToBeRemoved } from "../src/index.js";

afterEach(async () => {
    await cleanup();
});

describe("waitFor", () => {
    it("resolves when callback succeeds", async () => {
        let value = 0;
        setTimeout(() => {
            value = 42;
        }, 50);

        const result = await waitFor(() => {
            if (value !== 42) throw new Error("Not ready");
            return value;
        });

        expect(result).toBe(42);
    });

    it("retries until callback succeeds", async () => {
        let attempts = 0;

        await waitFor(() => {
            attempts++;
            if (attempts < 3) throw new Error("Not ready");
            return true;
        });

        expect(attempts).toBeGreaterThanOrEqual(3);
    });

    it("respects custom timeout", async () => {
        const start = Date.now();

        await expect(
            waitFor(
                () => {
                    throw new Error("Never succeeds");
                },
                { timeout: 100 },
            ),
        ).rejects.toThrow();

        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(100);
        expect(elapsed).toBeLessThan(200);
    });

    it("respects custom interval", async () => {
        let callCount = 0;

        await expect(
            waitFor(
                () => {
                    callCount++;
                    throw new Error("Never succeeds");
                },
                { timeout: 300, interval: 50 },
            ),
        ).rejects.toThrow();

        expect(callCount).toBeGreaterThanOrEqual(2);
        expect(callCount).toBeLessThanOrEqual(8);
    });

    it("calls onTimeout handler when timing out", async () => {
        const customError = new Error("Custom timeout message");

        await expect(
            waitFor(
                () => {
                    throw new Error("Never succeeds");
                },
                {
                    timeout: 100,
                    onTimeout: () => customError,
                },
            ),
        ).rejects.toThrow("Custom timeout message");
    });

    describe("error handling", () => {
        it("includes last error message in timeout error", async () => {
            await expect(
                waitFor(
                    () => {
                        throw new Error("Specific failure reason");
                    },
                    { timeout: 100 },
                ),
            ).rejects.toThrow("Specific failure reason");
        });
    });
});

describe("waitForElementToBeRemoved", () => {
    it("resolves when element is removed from tree", async () => {
        const DynamicComponent = () => {
            const [showLabel, setShowLabel] = useState(true);
            return (
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                    <GtkButton label="Remove" onClicked={() => setShowLabel(false)} />
                    {showLabel && <GtkLabel label="Temporary" />}
                </GtkBox>
            );
        };

        await render(<DynamicComponent />);

        const label = await screen.findByText("Temporary");
        const removeButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Remove" });

        const removalPromise = waitForElementToBeRemoved(label);
        await userEvent.click(removeButton);

        await removalPromise;
    });

    it("accepts callback that returns element", async () => {
        const DynamicComponent = () => {
            const [showLabel, setShowLabel] = useState(true);
            return (
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                    <GtkButton label="Remove" onClicked={() => setShowLabel(false)} />
                    {showLabel && <GtkLabel label="ToRemove" name="removable" />}
                </GtkBox>
            );
        };

        await render(<DynamicComponent />);

        const removeButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Remove" });

        const element = await screen.findByTestId("removable");

        const removalPromise = waitForElementToBeRemoved(() => {
            try {
                const parent = element.getParent();
                return parent ? element : null;
            } catch {
                return null;
            }
        });

        await userEvent.click(removeButton);
        await removalPromise;
    });

    it("respects custom timeout", async () => {
        await render(<GtkLabel label="Permanent" />);

        const label = await screen.findByText("Permanent");

        await expect(waitForElementToBeRemoved(label, { timeout: 100 })).rejects.toThrow("Timed out");
    });

    describe("error handling", () => {
        it("throws immediately if element is already removed", async () => {
            await render(<GtkLabel label="Test" />);

            await expect(waitForElementToBeRemoved(null as never)).rejects.toThrow("already removed");
        });

        it("throws if callback returns null initially", async () => {
            await render(<GtkLabel label="Test" />);

            await expect(waitForElementToBeRemoved(() => null)).rejects.toThrow("already removed");
        });
    });
});
