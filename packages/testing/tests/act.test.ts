import { describe, expect, it, vi } from "vitest";
import { getIsReactActEnvironment, setIsReactActEnvironment } from "../src/act.js";
import { act } from "../src/index.js";

function disableActEnvironment(): boolean | undefined {
    const before = getIsReactActEnvironment();
    setIsReactActEnvironment(false);

    return before;
}

function expectActEnvironmentRestored(before: boolean | undefined): void {
    expect(getIsReactActEnvironment()).toBe(false);
    setIsReactActEnvironment(before);
}

describe("act / sync callback", () => {
    it("returns a thenable", async () => {
        const result = act(vi.fn());
        expect(typeof (result as { then?: unknown }).then).toBe("function");
        await result;
    });

    it("runs the callback synchronously before resolving", () => {
        let isRan = false;

        act(() => {
            isRan = true;
        });

        expect(isRan).toBe(true);
    });

    it("resolves with the callback result", async () => {
        const value = await act(() => 42);
        expect(value).toBe(42);
    });

    it("drains queued microtasks before resolving", async () => {
        const order: number[] = [];

        await act(() => {
            queueMicrotask(() => {
                order.push(2);
            });

            order.push(1);
        });

        order.push(3);
        expect(order).toEqual([1, 2, 3]);
    });
});

describe("act / async callback", () => {
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

    it("propagates the resolved value", async () => {
        const value = await act(async () => {
            await Promise.resolve();

            return "ready";
        });

        expect(value).toBe("ready");
    });
});

describe("act / IS_REACT_ACT_ENVIRONMENT", () => {
    it("sets the flag inside a sync callback and restores it once the act settles", async () => {
        const before = disableActEnvironment();
        let isInsideEnv: boolean | undefined;

        await act(() => {
            isInsideEnv = getIsReactActEnvironment();
        });

        expect(isInsideEnv).toBe(true);
        expectActEnvironmentRestored(before);
    });

    it("keeps the flag set across an async callback and restores it on settle", async () => {
        const before = disableActEnvironment();
        let wasEnvSetBeforeAwait: boolean | undefined;
        let wasEnvSetAfterAwait: boolean | undefined;

        await act(async () => {
            wasEnvSetBeforeAwait = getIsReactActEnvironment();
            await Promise.resolve();
            wasEnvSetAfterAwait = getIsReactActEnvironment();
        });

        expect(wasEnvSetBeforeAwait).toBe(true);
        expect(wasEnvSetAfterAwait).toBe(true);
        expectActEnvironmentRestored(before);
    });

    it("restores the flag after a sync throw", () => {
        const before = disableActEnvironment();

        expect(() =>
            act(() => {
                throw new Error("boom");
            }),
        ).toThrow("boom");

        expectActEnvironmentRestored(before);
    });

    it("restores the flag after an async rejection", async () => {
        const before = disableActEnvironment();

        await expect(
            act(async () => {
                await Promise.resolve();
                throw new Error("boom");
            }),
        ).rejects.toThrow("boom");

        expectActEnvironmentRestored(before);
    });
});
