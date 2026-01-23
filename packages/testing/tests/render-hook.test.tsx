import { GtkApplicationWindow } from "@gtkx/react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "../src/index.js";

describe("renderHook", () => {
    it("renders a hook and returns its result", async () => {
        const { result } = await renderHook(() => useState(42));
        expect(result.current[0]).toBe(42);
    });

    it("updates result when hook state changes", async () => {
        const { result, rerender } = await renderHook(() => useState(0));

        expect(result.current[0]).toBe(0);

        const [, setState] = result.current;
        setState(10);
        await rerender();

        expect(result.current[0]).toBe(10);
    });

    describe("initialProps", () => {
        it("passes initialProps to the hook callback", async () => {
            const { result } = await renderHook(({ value }: { value: number }) => value * 2, {
                initialProps: { value: 5 },
            });

            expect(result.current).toBe(10);
        });

        it("works without initialProps", async () => {
            const { result } = await renderHook(() => "no props");
            expect(result.current).toBe("no props");
        });
    });

    describe("rerender", () => {
        it("re-renders the hook with the same props", async () => {
            let renderCount = 0;
            const { result, rerender } = await renderHook(() => {
                renderCount++;
                return renderCount;
            });

            expect(result.current).toBe(1);

            await rerender();
            expect(result.current).toBe(2);
        });

        it("re-renders the hook with new props", async () => {
            const { result, rerender } = await renderHook(({ multiplier }: { multiplier: number }) => 10 * multiplier, {
                initialProps: { multiplier: 2 },
            });

            expect(result.current).toBe(20);

            await rerender({ multiplier: 5 });
            expect(result.current).toBe(50);
        });

        it("preserves hook state across rerenders", async () => {
            const { result, rerender } = await renderHook(() => {
                const [count, setCount] = useState(0);
                return { count, increment: () => setCount((c) => c + 1) };
            });

            expect(result.current.count).toBe(0);

            result.current.increment();
            await rerender();

            expect(result.current.count).toBe(1);
        });
    });

    describe("unmount", () => {
        it("unmounts the component containing the hook", async () => {
            let unmounted = false;
            const { unmount } = await renderHook(() => {
                useEffect(() => {
                    return () => {
                        unmounted = true;
                    };
                }, []);
            });

            expect(unmounted).toBe(false);
            await unmount();
            expect(unmounted).toBe(true);
        });

        it("cleans up after unmount", async () => {
            const cleanup: (() => void)[] = [];
            const { unmount } = await renderHook(() => {
                useEffect(() => {
                    return () => {
                        cleanup.push(() => {});
                    };
                }, []);
            });

            await unmount();
            expect(cleanup.length).toBe(1);
        });
    });

    describe("wrapper option", () => {
        it("does not wrap by default (wrapper: false)", async () => {
            const { result } = await renderHook(() => useState("test"));
            expect(result.current[0]).toBe("test");
        });

        it("wraps in GtkApplicationWindow when wrapper is true", async () => {
            const { result } = await renderHook(() => useState("wrapped"), { wrapper: true });
            expect(result.current[0]).toBe("wrapped");
        });

        it("uses custom wrapper component", async () => {
            let wrapperRendered = false;

            const CustomWrapper = ({ children }: { children: ReactNode }) => {
                wrapperRendered = true;
                return <GtkApplicationWindow>{children}</GtkApplicationWindow>;
            };

            await renderHook(() => useState(0), { wrapper: CustomWrapper });

            expect(wrapperRendered).toBe(true);
        });
    });

    describe("error handling", () => {
        it("throws when hook throws on initial render", async () => {
            const errorHook = () => {
                throw new Error("Hook error");
            };

            await expect(renderHook(errorHook)).rejects.toThrow("Hook error");
        });

        it("throws when hook throws on rerender", async () => {
            let shouldThrow = false;
            const conditionalErrorHook = () => {
                if (shouldThrow) {
                    throw new Error("Rerender error");
                }
                return "ok";
            };

            const { result, rerender } = await renderHook(conditionalErrorHook);
            expect(result.current).toBe("ok");

            shouldThrow = true;
            await expect(rerender()).rejects.toThrow("Rerender error");
        });
    });

    describe("complex hooks", () => {
        it("works with useState", async () => {
            const { result, rerender } = await renderHook(() => useState({ count: 0 }));

            expect(result.current[0]).toEqual({ count: 0 });

            const [, setState] = result.current;
            setState({ count: 5 });
            await rerender();

            expect(result.current[0]).toEqual({ count: 5 });
        });

        it("works with useCallback", async () => {
            const { result, rerender } = await renderHook(
                ({ value }: { value: number }) => useCallback(() => value, [value]),
                {
                    initialProps: { value: 1 },
                },
            );

            const callback1 = result.current;
            expect(callback1()).toBe(1);

            await rerender({ value: 2 });
            const callback2 = result.current;
            expect(callback2()).toBe(2);
            expect(callback1).not.toBe(callback2);
        });

        it("works with useRef", async () => {
            const { result, rerender } = await renderHook(() => {
                const ref = useRef(0);
                ref.current++;
                return ref;
            });

            expect(result.current.current).toBe(1);

            await rerender();
            expect(result.current.current).toBe(2);
        });

        it("works with useEffect", async () => {
            const effects: string[] = [];

            const { rerender, unmount } = await renderHook(
                ({ value }: { value: string }) => {
                    useEffect(() => {
                        effects.push(`effect:${value}`);
                        return () => {
                            effects.push(`cleanup:${value}`);
                        };
                    }, [value]);
                },
                { initialProps: { value: "a" } },
            );

            expect(effects).toEqual(["effect:a"]);

            await rerender({ value: "b" });
            expect(effects).toEqual(["effect:a", "cleanup:a", "effect:b"]);

            await unmount();
            expect(effects).toEqual(["effect:a", "cleanup:a", "effect:b", "cleanup:b"]);
        });

        it("works with custom hooks", async () => {
            const useCounter = (initial: number) => {
                const [count, setCount] = useState(initial);
                return {
                    count,
                    increment: () => setCount((c) => c + 1),
                    decrement: () => setCount((c) => c - 1),
                };
            };

            const { result, rerender } = await renderHook(({ initial }: { initial: number }) => useCounter(initial), {
                initialProps: { initial: 10 },
            });

            expect(result.current.count).toBe(10);

            result.current.increment();
            await rerender();
            expect(result.current.count).toBe(11);

            result.current.decrement();
            result.current.decrement();
            await rerender();
            expect(result.current.count).toBe(9);
        });
    });
});
