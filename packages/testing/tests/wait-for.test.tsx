import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { type ReactNode, useState } from "react";
import { describe, expect, it } from "vitest";
import { findByText, render, screen, userEvent, waitFor, waitForElementToBeRemoved } from "../src/index.js";

const createDynamicComponent = (removableContent: ReactNode) => () => {
    const [showLabel, setShowLabel] = useState(true);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkButton
                label="Remove"
                onClicked={() => {
                    setShowLabel(false);
                }}
            />
            {showLabel && removableContent}
        </GtkBox>
    );
};

const assertReady = (isReady: boolean): void => {
    if (!isReady) {
        throw new Error("Not ready");
    }
};

const elementIfAttached = (element: Gtk.Widget): Gtk.Widget | null => {
    try {
        const parent = element.getParent();

        return parent ? element : null;
    } catch {
        return null;
    }
};

const waitForRemovalOfAbsentTarget = async (
    target: Parameters<typeof waitForElementToBeRemoved>[0],
): Promise<void> => {
    await render(<GtkLabel>Test</GtkLabel>);

    return waitForElementToBeRemoved(target);
};

async function renderRemovable(removableContent: ReactNode) {
    const DynamicComponent = createDynamicComponent(removableContent);
    await render(<DynamicComponent />);

    return screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Remove" });
}

describe("waitFor resolves", () => {
    it("resolves when callback succeeds", async () => {
        let value = 0;

        setTimeout(() => {
            value = 42;
        }, 50);

        const result = await waitFor(() => {
            assertReady(value === 42);

            return value;
        });

        expect(result).toBe(42);
    });

    it("retries until callback succeeds", async () => {
        let attempts = 0;

        await waitFor(() => {
            attempts++;
            assertReady(attempts >= 3);

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
        const { container } = await render(<GtkLabel>Present</GtkLabel>);

        await expect(
            findByText(container, "Missing", { timeout: 100, onTimeout: () => new Error("custom find timeout") }),
        ).rejects.toThrow("custom find timeout");
    });
});

describe("waitForElementToBeRemoved widget", () => {
    it("resolves when element is removed from tree", async () => {
        const removalButton = await renderRemovable(<GtkButton label="Temporary" />);
        const tempButton = await screen.findByText("Temporary");
        const removalPromise = waitForElementToBeRemoved(tempButton);
        await userEvent.click(removalButton);
        await expect(removalPromise).resolves.toBeUndefined();
    });

    it("accepts callback that returns element", async () => {
        const removalButton = await renderRemovable(<GtkButton label="ToRemove" name="removable" />);
        const element = await screen.findByName("removable");
        const removalPromise = waitForElementToBeRemoved(() => elementIfAttached(element));
        await userEvent.click(removalButton);
        await expect(removalPromise).resolves.toBeUndefined();
    });

    it("resolves when the element's getRoot throws mid-wait", async () => {
        const removalButton = await renderRemovable(<GtkButton label="ToDestroy" name="destroyable" />);
        const element = await screen.findByName("destroyable");
        const originalGetRoot = element.getRoot.bind(element);

        element.getRoot = () => {
            const root = originalGetRoot();

            if (root === null) {
                throw new Error("Widget destroyed");
            }

            return root;
        };

        const removalPromise = waitForElementToBeRemoved(element);
        await userEvent.click(removalButton);
        await expect(removalPromise).resolves.toBeUndefined();
    });

    it("resolves once every widget in an array is removed", async () => {
        const removalButton = await renderRemovable(
            <>
                <GtkButton label="First" />
                <GtkButton label="Second" />
            </>,
        );

        const first = await screen.findByText("First");
        const second = await screen.findByText("Second");
        const removalPromise = waitForElementToBeRemoved([first, second]);
        await userEvent.click(removalButton);
        await expect(removalPromise).resolves.toBeUndefined();
    });

    it("throws immediately when given an empty array", async () => {
        await expect(waitForRemovalOfAbsentTarget([])).rejects.toThrow("already removed");
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
        await expect(waitForRemovalOfAbsentTarget(null as never)).rejects.toThrow("already removed");
    });

    it("throws if callback returns null initially", async () => {
        await expect(waitForRemovalOfAbsentTarget(() => null)).rejects.toThrow("already removed");
    });
});
