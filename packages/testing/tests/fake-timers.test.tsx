import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "../src/index.js";

type FakeTimerOptions = Parameters<typeof vi.useFakeTimers>[0];

const TEST_TIMEOUT = 5000;
const DEBOUNCE_MS = 200;
const TIMED_OUT_MESSAGE = "Timed out after 100ms";

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

const renderLabelWithFakeTimers = async (options?: FakeTimerOptions): Promise<void> => {
    vi.useFakeTimers(options);
    await render(<GtkLabel>Present</GtkLabel>);
};

afterEach(() => {
    vi.useRealTimers();
});

describe("waitFor under fake timers", () => {
    it("resolves when the callback already passes", async () => {
        await renderLabelWithFakeTimers();
        await expect(waitFor(() => screen.getByText("Present"))).resolves.toBeDefined();
    }, TEST_TIMEOUT);

    it("rejects when the callback never passes", async () => {
        await renderLabelWithFakeTimers();
        await expect(waitFor(failingCallback, { timeout: 100 })).rejects.toThrow(TIMED_OUT_MESSAGE);
    }, TEST_TIMEOUT);

    it("resolves when only setTimeout is faked", async () => {
        await renderLabelWithFakeTimers({ toFake: ["setTimeout"] });
        await expect(waitFor(() => screen.getByText("Present"))).resolves.toBeDefined();
    }, TEST_TIMEOUT);

    it("rejects when only Date is faked", async () => {
        await renderLabelWithFakeTimers({ toFake: ["Date"] });
        await expect(waitFor(failingCallback, { timeout: 100 })).rejects.toThrow(TIMED_OUT_MESSAGE);
    }, TEST_TIMEOUT);

    it("advances the installed fake clock so a component timeout progresses", async () => {
        vi.useFakeTimers();
        await render(<DebouncedLabel />);
        await expect(waitFor(() => screen.getByText("Settled"))).resolves.toBeDefined();
    }, TEST_TIMEOUT);
});

describe("queries and user events under fake timers", () => {
    it("resolves findByText for a widget that is already present", async () => {
        await renderLabelWithFakeTimers();
        await expect(screen.findByText("Present")).resolves.toBeDefined();
    }, TEST_TIMEOUT);

    it("resolves userEvent.click", async () => {
        let clickCount = 0;

        const handlePress = (): void => {
            clickCount++;
        };

        vi.useFakeTimers();
        await render(<GtkButton label="Press" onClicked={handlePress} />);
        await userEvent.click(screen.getByText("Press"));
        expect(clickCount).toBe(1);
    }, TEST_TIMEOUT);
});
