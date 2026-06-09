import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
import { type ReactNode, useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, userEvent, waitFor, waitForElementToBeRemoved } from "../src/index.js";

/**
 * Builds a component that renders a "Remove" button which hides the given
 * `removableContent` when clicked, used to exercise element-removal waits.
 */
const createDynamicComponent = (removableContent: ReactNode) => () => {
    const [showLabel, setShowLabel] = useState(true);
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkButton label="Remove" onClicked={() => setShowLabel(false)} />
            {showLabel && removableContent}
        </GtkBox>
    );
};

describe("waitFor resolves", () => {
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
});

describe("waitFor timing", () => {
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
});

describe("waitFor error handling", () => {
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

describe("waitForElementToBeRemoved widget", () => {
    it("resolves when element is removed from tree", async () => {
        const DynamicComponent = createDynamicComponent(<GtkButton label="Temporary" />);

        await render(<DynamicComponent />);

        const tempButton = await screen.findByText("Temporary");
        const removeButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Remove" });

        const removalPromise = waitForElementToBeRemoved(tempButton);
        await userEvent.click(removeButton);

        await expect(removalPromise).resolves.toBeUndefined();
    });

    it("accepts callback that returns element", async () => {
        const DynamicComponent = createDynamicComponent(<GtkButton label="ToRemove" name="removable" />);

        await render(<DynamicComponent />);

        const removeButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Remove" });

        const element = await screen.findByName("removable");

        const removalPromise = waitForElementToBeRemoved(() => {
            try {
                const parent = element.getParent();
                return parent ? element : null;
            } catch {
                return null;
            }
        });

        await userEvent.click(removeButton);
        await expect(removalPromise).resolves.toBeUndefined();
    });
});

describe("waitForElementToBeRemoved timeout", () => {
    it("respects custom timeout", async () => {
        await render(<GtkButton label="Permanent" />);

        const widget = await screen.findByText("Permanent");

        await expect(waitForElementToBeRemoved(widget, { timeout: 100 })).rejects.toThrow("Timed out");
    });
});

describe("waitForElementToBeRemoved error handling", () => {
    it("throws immediately if element is already removed", async () => {
        await render("Test");

        await expect(waitForElementToBeRemoved(null as never)).rejects.toThrow("already removed");
    });

    it("throws if callback returns null initially", async () => {
        await render("Test");

        await expect(waitForElementToBeRemoved(() => null)).rejects.toThrow("already removed");
    });
});
