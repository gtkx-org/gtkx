import { describe, expect, it } from "vitest";
import { act } from "../src/index.js";

describe("act", () => {
    it("returns a promise", async () => {
        const result = act(() => {});
        expect(result).toBeInstanceOf(Promise);
        await result;
    });

    it("resolves after running the callback", async () => {
        let ran = false;
        await act(() => {
            ran = true;
        });
        expect(ran).toBe(true);
    });

    it("returns the callback result", async () => {
        const value = await act(() => 42);
        expect(value).toBe(42);
    });

    it("awaits async callbacks before resolving", async () => {
        const order: number[] = [];
        await act(async () => {
            order.push(1);
            await Promise.resolve();
            order.push(2);
        });
        order.push(3);
        expect(order).toEqual([1, 2, 3]);
    });

    it("drains queued microtasks before resolving", async () => {
        const order: number[] = [];
        await act(() => {
            queueMicrotask(() => order.push(2));
            order.push(1);
        });
        order.push(3);
        expect(order).toEqual([1, 2, 3]);
    });

    it("does not yield to macrotasks (setTimeout-deferred work stays outside act)", async () => {
        const order: number[] = [];
        await act(() => {
            setTimeout(() => order.push(99), 0);
            order.push(1);
        });
        order.push(2);
        expect(order).toEqual([1, 2]);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(order).toEqual([1, 2, 99]);
    });
});
