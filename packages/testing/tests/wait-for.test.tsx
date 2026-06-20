import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { type ReactNode, useState } from "react";
import { describe, expect, it } from "vitest";
import { findByText, render, screen, userEvent, waitFor, waitForElementToBeRemoved } from "../src/index.js";

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

    it("throws a TypeError when the callback is not a function", () => {
        expect(() => waitFor(undefined as never)).toThrow(TypeError);
        expect(() => waitFor(undefined as never)).toThrow(/callback.*must be a function/);
    });
});

describe("findBy forwards waitForOptions", () => {
    it("routes a custom onTimeout through the find query", async () => {
        const { container } = await render(<GtkLabel label="Present" />);
        await expect(
            findByText(container, "Missing", { timeout: 100, onTimeout: () => new Error("custom find timeout") }),
        ).rejects.toThrow("custom find timeout");
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

    it("resolves once every widget in an array is removed", async () => {
        const DynamicComponent = createDynamicComponent(
            <>
                <GtkButton label="First" />
                <GtkButton label="Second" />
            </>,
        );

        await render(<DynamicComponent />);

        const first = await screen.findByText("First");
        const second = await screen.findByText("Second");
        const removeButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Remove" });

        const removalPromise = waitForElementToBeRemoved([first, second]);
        await userEvent.click(removeButton);

        await expect(removalPromise).resolves.toBeUndefined();
    });

    it("throws immediately when given an empty array", async () => {
        await render(<GtkLabel label="Test" />);
        await expect(waitForElementToBeRemoved([])).rejects.toThrow("already removed");
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
        await render(<GtkLabel label="Test" />);

        await expect(waitForElementToBeRemoved(null as never)).rejects.toThrow("already removed");
    });

    it("throws if callback returns null initially", async () => {
        await render(<GtkLabel label="Test" />);

        await expect(waitForElementToBeRemoved(() => null)).rejects.toThrow("already removed");
    });
});
