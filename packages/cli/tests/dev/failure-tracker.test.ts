import { describe, expect, it, vi } from "vitest";
import { createFailureTracker } from "../../src/dev/failure-tracker.js";

describe("createFailureTracker", () => {
    it("starts clean and latches on the first failure", () => {
        const report = vi.fn();
        const tracker = createFailureTracker(report);
        expect(tracker.hasFailed()).toBe(false);
        const cause = new Error("boom");
        tracker.fail(cause);
        expect(tracker.hasFailed()).toBe(true);
        expect(report).toHaveBeenCalledExactlyOnceWith(cause);
    });

    it("reports the same cause once, however many channels deliver it", () => {
        const report = vi.fn();
        const tracker = createFailureTracker(report);
        const cause = new Error("boom");
        tracker.fail(cause);
        tracker.fail(cause);
        tracker.fail(cause);
        expect(report).toHaveBeenCalledTimes(1);
    });

    it("reports a different cause that arrives after a failure", () => {
        const report = vi.fn();
        const tracker = createFailureTracker(report);
        const first = new Error("first");
        const second = new Error("second");
        tracker.fail(first);
        tracker.fail(second);
        expect(report).toHaveBeenCalledTimes(2);
        expect(report).toHaveBeenLastCalledWith(second);
    });
});
