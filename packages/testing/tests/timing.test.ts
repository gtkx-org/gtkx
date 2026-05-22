import { describe, expect, it } from "vitest";
import { act } from "../src/index.js";

describe("act", () => {
    it("runs sync callbacks synchronously and returns their value", () => {
        let ran = false;
        const value = act(() => {
            ran = true;
            return 42;
        });
        expect(ran).toBe(true);
        expect(value).toBe(42);
    });

    it("returns a Promise for async callbacks and awaits them", async () => {
        const order: number[] = [];
        const result = act(async () => {
            order.push(1);
            await Promise.resolve();
            order.push(2);
            return "done";
        });
        expect(result).toBeInstanceOf(Promise);
        const value = await result;
        order.push(3);
        expect(order).toEqual([1, 2, 3]);
        expect(value).toBe("done");
    });

    it("yields the event loop after async callbacks before resolving", async () => {
        const order: number[] = [];

        const first = async () => {
            order.push(1);
            await act(async () => {
                order.push(2);
            });
            order.push(4);
        };

        const second = async () => {
            order.push(3);
        };

        const p1 = first();
        await second();
        await p1;

        expect(order).toEqual([1, 2, 3, 4]);
    });
});
