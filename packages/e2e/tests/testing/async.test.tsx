import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import {
    act,
    findByText,
    render,
    screen,
    userEvent,
    waitFor,
    waitForElementToBeRemoved,
    within,
} from "@gtkx/testing";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

type FakeTimerOptions = Parameters<typeof vi.useFakeTimers>[0];

const TEST_TIMEOUT = 5000;
const DEBOUNCE_MS = 200;

const failingCallback = (): never => {
    throw new Error("Never succeeds");
};

const DebouncedLabel = () => {
    const [text, setText] = useState("Pending");

    useEffect(() => {
        const handle = setTimeout(() => {
            setText("Settled");
        }, DEBOUNCE_MS);

        return () => {
            clearTimeout(handle);
        };
    }, []);

    return <GtkLabel>{text}</GtkLabel>;
};

const createDynamicComponent = (removableContent: ReactNode) => () => {
    const [isLabelShown, setIsLabelShown] = useState(true);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkButton
                label="Remove"
                onClicked={() => {
                    setIsLabelShown(false);
                }}
            />
            {isLabelShown && removableContent}
        </GtkBox>
    );
};

const customTimeout = (): Error => new Error("custom");
const attachedWidget = (widget: Gtk.Widget): Gtk.Widget | null => (widget.getParent() === null ? null : widget);

const renderRemovable = async (removableContent: ReactNode): Promise<Gtk.Widget> => {
    const DynamicComponent = createDynamicComponent(removableContent);
    await render(<DynamicComponent />);

    return screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Remove" });
};

const waitForRemovalOfAbsentTarget = async (
    target: Parameters<typeof waitForElementToBeRemoved>[0],
): Promise<void> => {
    await render(<GtkLabel>Test</GtkLabel>);

    return waitForElementToBeRemoved(target);
};

const renderLabelWithFakeTimers = async (options?: FakeTimerOptions): Promise<() => Gtk.Widget> => {
    vi.useFakeTimers(options);
    const { container } = await render(<GtkLabel>Present</GtkLabel>);

    return () => within(container).getByText("Present");
};

afterEach(() => {
    vi.useRealTimers();
});

describe("act (1)", () => {
    it("runs a sync callback eagerly, drains microtasks and resolves with its result", async () => {
        const order: number[] = [];
        let isRan = false;

        const settled = act(() => {
            isRan = true;

            queueMicrotask(() => {
                order.push(2);
            });

            order.push(1);
        });

        expect(isRan).toBe(true);
        expect(typeof (settled as { then?: unknown }).then).toBe("function");
        await settled;
        order.push(3);
        expect(order).toEqual([1, 2, 3]);
        expect(await act(() => 42)).toBe(42);
    });

    it("awaits an async callback before resolving and propagates its value", async () => {
        const order: number[] = [];

        const value = await act(async () => {
            order.push(1);
            await Promise.resolve();
            order.push(2);

            return "ready";
        });

        order.push(3);
        expect(order).toEqual([1, 2, 3]);
        expect(value).toBe("ready");
    });
});

describe("act (2)", () => {
    it("throws when the callback throws, synchronously or asynchronously", async () => {
        expect(() =>
            act(() => {
                throw new Error("boom");
            }),
        ).toThrow();

        await expect(
            act(async () => {
                await Promise.resolve();
                throw new Error("boom");
            }),
        ).rejects.toThrow();
    });
});

describe("waitFor (1)", () => {
    it("retries until the callback passes and resolves with its result", async () => {
        let value = 0;
        let attempts = 0;

        setTimeout(() => {
            value = 42;
        }, 50);

        const result = await waitFor(() => {
            attempts++;

            if (value !== 42) {
                throw new Error("Not ready");
            }

            return value;
        });

        expect(result).toBe(42);
        expect(attempts).toBeGreaterThan(1);
    });

    it("honors the timeout and the interval it is given", async () => {
        const start = Date.now();
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

        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(300);
        expect(callCount).toBeGreaterThanOrEqual(2);
    });
});

describe("waitFor (2)", () => {
    it("routes a custom onTimeout through waitFor and through a find query", async () => {
        await expect(waitFor(failingCallback, { timeout: 100, onTimeout: customTimeout })).rejects.toThrow();
        const { container } = await render(<GtkLabel>Present</GtkLabel>);

        await expect(
            findByText(container, "Missing", { timeout: 100, onTimeout: customTimeout }),
        ).rejects.toThrow();
    });

    it("throws when the callback is not a function", () => {
        expect(() => waitFor(undefined as never)).toThrow();
    });
});

describe("waitForElementToBeRemoved", () => {
    it("resolves once the widget, the widgets of an array or a callback target leave the tree", async () => {
        const removalButton = await renderRemovable(
            <>
                <GtkButton label="First" />
                <GtkButton label="Second" name="removable" />
            </>,
        );

        const first = await screen.findByText("First");
        const second = await screen.findByName("removable");
        const arrayRemoval = waitForElementToBeRemoved([first, second]);
        const callbackRemoval = waitForElementToBeRemoved(() => attachedWidget(second));
        await userEvent.click(removalButton);
        await expect(arrayRemoval).resolves.toBeUndefined();
        await expect(callbackRemoval).resolves.toBeUndefined();
    });

    it("resolves when reading the widget's root throws mid-wait", async () => {
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

    it("throws for a target that is absent, empty or never removed", async () => {
        await expect(waitForRemovalOfAbsentTarget([])).rejects.toThrow();
        await expect(waitForRemovalOfAbsentTarget(null as never)).rejects.toThrow();
        await expect(waitForRemovalOfAbsentTarget(() => null)).rejects.toThrow();
        await render(<GtkButton label="Permanent" />);
        const widget = await screen.findByText("Permanent");
        await expect(waitForElementToBeRemoved(widget, { timeout: 100 })).rejects.toThrow();
    });
});

describe("fake timers", () => {
    it("lets waitFor settle whether the whole clock, only setTimeout or only Date is faked", async () => {
        const faked = await renderLabelWithFakeTimers();
        await expect(waitFor(faked)).resolves.toHaveTextContent("Present");
        vi.useRealTimers();
        const partial = await renderLabelWithFakeTimers({ toFake: ["setTimeout"] });
        await expect(waitFor(partial)).resolves.toHaveTextContent("Present");
        vi.useRealTimers();
        await renderLabelWithFakeTimers({ toFake: ["Date"] });
        await expect(waitFor(failingCallback, { timeout: 100 })).rejects.toThrow();
    }, TEST_TIMEOUT);

    it("advances the installed fake clock so a component timeout progresses", async () => {
        vi.useFakeTimers();
        await render(<DebouncedLabel />);
        await expect(waitFor(() => screen.getByText("Settled"))).resolves.toHaveTextContent("Settled");
    }, TEST_TIMEOUT);

    it("keeps find queries and user events working", async () => {
        let clickCount = 0;
        vi.useFakeTimers();
        await render(<GtkButton label="Press" onClicked={() => (clickCount += 1)} />);
        await screen.findByText("Press");
        await userEvent.click(screen.getByText("Press"));
        expect(clickCount).toBe(1);
    }, TEST_TIMEOUT);
});
