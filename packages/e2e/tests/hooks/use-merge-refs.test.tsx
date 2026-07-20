import { useMergedRef } from "@gtkx/react/internal";
import { renderHook } from "@gtkx/testing";
import type { Ref } from "react";
import { describe, expect, it, vi } from "vitest";

interface Target {
    id: number;
}

const detachOf = (result: ReturnType<ReturnType<typeof useMergedRef<Target>>>): (() => void) => {
    if (typeof result !== "function") throw new Error("expected the merged ref to return a cleanup");
    return result;
};

describe("useMergedRef", () => {
    it("passes the attached value to callback refs and ref objects", async () => {
        const callback = vi.fn();
        const objectRef: { current: Target | null } = { current: null };
        const value: Target = { id: 1 };

        const { result } = await renderHook(() => useMergedRef<Target>(callback, objectRef));

        result.current(value);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(value);
        expect(objectRef.current).toBe(value);
    });

    it("runs a callback ref's returned cleanup on detach", async () => {
        const cleanup = vi.fn();
        const callback = vi.fn(() => cleanup);

        const { result } = await renderHook(() => useMergedRef<Target>(callback));

        const detach = detachOf(result.current({ id: 1 }));
        expect(cleanup).not.toHaveBeenCalled();

        detach();

        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("nulls ref objects on detach", async () => {
        const objectRef: { current: Target | null } = { current: null };
        const value: Target = { id: 1 };

        const { result } = await renderHook(() => useMergedRef<Target>(objectRef));

        const detach = detachOf(result.current(value));
        expect(objectRef.current).toBe(value);

        detach();

        expect(objectRef.current).toBeNull();
    });

    const renderSwappableRef = (initialRef: Ref<Target | null>) =>
        renderHook(({ ref }: { ref: Ref<Target | null> }) => useMergedRef<Target>(ref), {
            initialProps: { ref: initialRef },
        });

    it("moves the attached value when a ref object argument is swapped", async () => {
        const first: { current: Target | null } = { current: null };
        const second: { current: Target | null } = { current: null };
        const value: Target = { id: 1 };

        const { result, rerender } = await renderSwappableRef(first);

        result.current(value);
        expect(first.current).toBe(value);

        await rerender({ ref: second });

        expect(first.current).toBeNull();
        expect(second.current).toBe(value);
    });

    it("detaches a swapped callback ref through its cleanup", async () => {
        const cleanup = vi.fn();
        const firstCallback = vi.fn(() => cleanup);
        const secondCallback = vi.fn();
        const value: Target = { id: 1 };

        const { result, rerender } = await renderSwappableRef(firstCallback);

        result.current(value);
        expect(firstCallback).toHaveBeenCalledWith(value);

        await rerender({ ref: secondCallback });

        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(secondCallback).toHaveBeenCalledTimes(1);
        expect(secondCallback).toHaveBeenCalledWith(value);
    });

    it("leaves stable refs attached while an inline ref changes identity", async () => {
        const stableCleanup = vi.fn();
        const stable = vi.fn(() => stableCleanup);
        const inlineValues: Array<Target | null> = [];
        const value: Target = { id: 1 };

        const { result, rerender } = await renderHook(
            ({ tick }: { tick: number }) =>
                useMergedRef<Target>(stable, (instance) => {
                    inlineValues.push(instance);
                    void tick;
                }),
            { initialProps: { tick: 0 } },
        );

        result.current(value);
        expect(stable).toHaveBeenCalledTimes(1);
        expect(inlineValues).toEqual([value]);

        await rerender({ tick: 1 });
        await rerender({ tick: 2 });

        expect(stable).toHaveBeenCalledTimes(1);
        expect(stableCleanup).not.toHaveBeenCalled();
        expect(inlineValues).toEqual([value, null, value, null, value]);
    });

    it("keeps the merged callback identity stable across renders", async () => {
        const stable = vi.fn();

        const { result, rerender } = await renderHook(
            ({ tick }: { tick: number }) => useMergedRef<Target>(stable, () => void tick),
            { initialProps: { tick: 0 } },
        );

        const initial = result.current;

        await rerender({ tick: 1 });

        expect(result.current).toBe(initial);
    });
});
