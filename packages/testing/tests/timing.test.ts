import { describe, expect, it } from "vitest";
import { act } from "../src/index.js";

describe("act", () => {
    it("returns a promise", () => {
        const result = act(() => {});
        expect(result).toBeInstanceOf(Promise);
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

    it("yields the event loop before resolving", async () => {
        const order: number[] = [];

        const first = async () => {
            order.push(1);
            await act(() => {});
            order.push(3);
        };

        const second = async () => {
            order.push(2);
        };

        const p1 = first();
        await second();
        await p1;

        expect(order).toEqual([1, 2, 3]);
    });
});
