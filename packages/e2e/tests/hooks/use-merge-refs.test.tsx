import type * as Gtk from "@gtkx/gi/gtk";
import type { Ref, RefCallback } from "react";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useMergedRef } from "@gtkx/react/internal";
import { render, renderHook } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";

type Target = {
    id: number;
};

const getDetach = (result: ReturnType<ReturnType<typeof useMergedRef<Target>>>): (() => void) => {
    if (typeof result !== "function") {
        throw new TypeError("expected the merged ref to return a cleanup");
    }

    return result;
};

const renderSwappableRef = (initialRef: Ref<Target | null>) =>
    renderHook(({ ref }: { ref: Ref<Target | null> }) => useMergedRef<Target>(ref, undefined), {
        initialProps: { ref: initialRef },
    });

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
        const { result } = await renderHook(() => useMergedRef<Target>(callback, undefined));
        const detach = getDetach(result.current({ id: 1 }));
        expect(cleanup).not.toHaveBeenCalled();
        detach();
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("nulls ref objects through the returned cleanup", async () => {
        const objectRef: { current: Target | null } = { current: null };
        const callbackCleanup = vi.fn();
        const callback = vi.fn(() => callbackCleanup);
        const value: Target = { id: 1 };
        const { result } = await renderHook(() => useMergedRef<Target>(objectRef, callback));
        const detach = getDetach(result.current(value));
        expect(objectRef.current).toBe(value);
        detach();
        expect(objectRef.current).toBeNull();
        expect(callbackCleanup).toHaveBeenCalledTimes(1);
    });
});

describe("useMergedRef (swapped refs)", () => {
    it("forwards to the swapped ref object", async () => {
        const first: { current: Target | null } = { current: null };
        const second: { current: Target | null } = { current: null };
        const value: Target = { id: 1 };
        const { result, rerender } = await renderSwappableRef(first);
        await rerender({ ref: second });
        result.current(value);
        expect(second.current).toBe(value);
        expect(first.current).toBeNull();
    });

    it("forwards to the swapped callback ref", async () => {
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();
        const value: Target = { id: 1 };
        const { result, rerender } = await renderSwappableRef(firstCallback);
        await rerender({ ref: secondCallback });
        result.current(value);
        expect(secondCallback).toHaveBeenCalledWith(value);
        expect(firstCallback).not.toHaveBeenCalled();
    });
});

describe("useMergedRef (widget reattachment)", () => {
    it("reattaches a widget ref when one of its ref arguments changes identity", async () => {
        const attach = vi.fn<RefCallback<Gtk.Button>>();

        function App({ tick }: { tick: number }) {
            const merged = useMergedRef<Gtk.Button>(attach, vi.fn<RefCallback<Gtk.Button>>());

            return <GtkButton label={`tick ${String(tick)}`} ref={merged} />;
        }

        const { rerender } = await render(<App tick={0} />);
        expect(attach).toHaveBeenCalledTimes(1);
        const button = attach.mock.calls[0]?.[0];
        expect(button).not.toBeNull();
        await rerender(<App tick={1} />);
        expect(attach).toHaveBeenCalledWith(null);
        expect(attach.mock.calls.at(-1)?.[0]).toBe(button);
        expect(attach.mock.calls.length).toBeGreaterThan(1);
    });

    it("does not reattach a widget ref across a re-render while its ref arguments are stable", async () => {
        const attach = vi.fn<RefCallback<Gtk.Button>>();
        const objectRef: { current: Gtk.Button | null } = { current: null };

        function App({ tick }: { tick: number }) {
            const merged = useMergedRef<Gtk.Button>(attach, objectRef);

            return <GtkButton label={`tick ${String(tick)}`} ref={merged} />;
        }

        const { rerender } = await render(<App tick={0} />);
        expect(attach).toHaveBeenCalledTimes(1);
        const button = objectRef.current;
        expect(button).not.toBeNull();
        await rerender(<App tick={1} />);
        expect(attach).toHaveBeenCalledTimes(1);
        expect(attach).not.toHaveBeenCalledWith(null);
        expect(objectRef.current).toBe(button);
    });
});
