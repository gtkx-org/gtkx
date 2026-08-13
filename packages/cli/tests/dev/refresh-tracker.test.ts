import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRefreshTracker } from "../../src/dev/refresh-tracker.js";

describe("createRefreshTracker", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("invokes the underlying refresh, reports what it patched, and opens the window for one macrotask", () => {
        const performRefresh = vi.fn(() => 2);
        const tracker = createRefreshTracker(performRefresh);
        expect(tracker.isRefreshing()).toBe(false);
        expect(tracker.performRefresh()).toBe(2);
        expect(performRefresh).toHaveBeenCalledTimes(1);
        expect(tracker.isRefreshing()).toBe(true);
        vi.runAllTimers();
        expect(tracker.isRefreshing()).toBe(false);
    });

    it("reports a refresh that patched nothing", () => {
        const tracker = createRefreshTracker(() => 0);
        expect(tracker.performRefresh()).toBe(0);
        vi.runAllTimers();
        expect(tracker.isRefreshing()).toBe(false);
    });

    it("closes the window even when the refresh throws", () => {
        const tracker = createRefreshTracker(() => {
            throw new Error("boom");
        });

        expect(() => {
            tracker.performRefresh();
        }).toThrow("boom");

        expect(tracker.isRefreshing()).toBe(true);
        vi.runAllTimers();
        expect(tracker.isRefreshing()).toBe(false);
    });
});
