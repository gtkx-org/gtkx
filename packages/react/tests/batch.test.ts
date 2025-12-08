import { describe, expect, it, vi } from "vitest";
import { beginCommit, endCommit, scheduleFlush } from "../src/batch.js";

describe("batch", () => {
    describe("scheduleFlush", () => {
        it("executes callback immediately when not in commit", () => {
            const callback = vi.fn();

            scheduleFlush(callback);

            expect(callback).toHaveBeenCalledOnce();
        });

        it("defers callback execution during commit", () => {
            const callback = vi.fn();

            beginCommit();
            scheduleFlush(callback);

            expect(callback).not.toHaveBeenCalled();

            endCommit();

            expect(callback).toHaveBeenCalledOnce();
        });

        it("executes multiple deferred callbacks on endCommit", () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const callback3 = vi.fn();

            beginCommit();
            scheduleFlush(callback1);
            scheduleFlush(callback2);
            scheduleFlush(callback3);

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).not.toHaveBeenCalled();
            expect(callback3).not.toHaveBeenCalled();

            endCommit();

            expect(callback1).toHaveBeenCalledOnce();
            expect(callback2).toHaveBeenCalledOnce();
            expect(callback3).toHaveBeenCalledOnce();
        });

        it("clears pending flushes after endCommit", () => {
            const callback = vi.fn();

            beginCommit();
            scheduleFlush(callback);
            endCommit();

            expect(callback).toHaveBeenCalledOnce();

            endCommit();

            expect(callback).toHaveBeenCalledOnce();
        });

        it("deduplicates same callback during commit", () => {
            const callback = vi.fn();

            beginCommit();
            scheduleFlush(callback);
            scheduleFlush(callback);
            scheduleFlush(callback);
            endCommit();

            expect(callback).toHaveBeenCalledOnce();
        });

        it("handles nested begin/end commit correctly", () => {
            const callback = vi.fn();

            beginCommit();
            scheduleFlush(callback);

            beginCommit();

            expect(callback).not.toHaveBeenCalled();

            endCommit();

            expect(callback).toHaveBeenCalledOnce();
        });
    });
});
