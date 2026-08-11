import { describe, expect, it, vi } from "vitest";
import { createFailureTracker, type FailureTracker } from "../../src/dev/failure-tracker.js";

type Harness = {
    tracker: FailureTracker;
    announce: ReturnType<typeof vi.fn>;
    setRefreshing: (isRefreshing: boolean) => void;
};

const buildTracker = (): Harness => {
    const announce = vi.fn();
    const refresh = { isRefreshing: false };
    const tracker = createFailureTracker(announce, () => refresh.isRefreshing);

    return {
        tracker,
        announce,
        setRefreshing: (isRefreshing) => {
            refresh.isRefreshing = isRefreshing;
        },
    };
};

const settleTimers = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("createFailureTracker (reporting)", () => {
    it("starts clean and keeps the session up for an error reported on its own", () => {
        const { tracker, announce } = buildTracker();
        expect(tracker.isDown()).toBe(false);
        expect(tracker.hasReported()).toBe(false);
        const cause = new Error("stray rejection");
        tracker.report(cause);
        expect(announce).toHaveBeenCalledExactlyOnceWith(cause);
        expect(tracker.hasReported()).toBe(true);
        expect(tracker.isDown()).toBe(false);
    });

    it("announces each distinct cause once, however many channels deliver it", () => {
        const { tracker, announce } = buildTracker();
        const first = new Error("first");
        const second = new Error("second");
        tracker.report(first);
        tracker.report(second);
        tracker.report(first);
        expect(announce).toHaveBeenCalledTimes(2);
        expect(announce).toHaveBeenNthCalledWith(1, first);
        expect(announce).toHaveBeenNthCalledWith(2, second);
    });

    it("announces a cause it cannot remember every time it arrives", () => {
        const { tracker, announce } = buildTracker();
        tracker.report("boom");
        tracker.report("boom");
        expect(announce).toHaveBeenCalledTimes(2);
    });
});

describe("createFailureTracker (bringing the session down)", () => {
    it("goes down on an error reported while a refresh pass is in flight", () => {
        const { tracker, setRefreshing } = buildTracker();
        setRefreshing(true);
        tracker.report(new Error("render throw"));
        expect(tracker.isDown()).toBe(true);
    });

    it("goes down on an error reported while an unmount is settling", async () => {
        const { tracker } = buildTracker();
        const decide = vi.fn();
        tracker.settleUnmount(decide);
        tracker.report(new Error("render throw"));
        expect(tracker.isDown()).toBe(true);
        await settleTimers();
        expect(decide).toHaveBeenCalledTimes(1);
    });

    it("closes the unmount window once the decision has run", async () => {
        const { tracker } = buildTracker();
        tracker.settleUnmount(vi.fn());
        await settleTimers();
        tracker.report(new Error("later rejection"));
        expect(tracker.isDown()).toBe(false);
    });

    it("goes down without a cause when the caller already explained the failure", () => {
        const { tracker, announce } = buildTracker();
        tracker.fail();
        expect(tracker.isDown()).toBe(true);
        expect(tracker.hasReported()).toBe(false);
        expect(announce).not.toHaveBeenCalled();
    });

    it("announces the cause it goes down with", () => {
        const { tracker, announce } = buildTracker();
        const cause = new Error("entry blew up");
        tracker.fail(cause);
        expect(tracker.isDown()).toBe(true);
        expect(announce).toHaveBeenCalledExactlyOnceWith(cause);
    });
});
