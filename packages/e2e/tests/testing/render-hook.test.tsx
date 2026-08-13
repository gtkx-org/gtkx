import type { ReactNode } from "react";
import { act, renderHook } from "@gtkx/testing";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { describe, expect, it } from "vitest";

const errorHook = (): never => {
    throw new Error("Hook error");
};

const useCounter = (initial: number) => {
    const [count, setCount] = useState(initial);

    return {
        count,
        increment: () => {
            setCount((current) => current + 1);
        },
        decrement: () => {
            setCount((current) => current - 1);
        },
    };
};

describe("renderHook (1)", () => {
    it("returns the hook result and keeps it current as its state changes", async () => {
        const { result } = await renderHook(() => useState({ count: 0 }));
        expect(result.current[0]).toEqual({ count: 0 });
        const [, setState] = result.current;

        await act(() => {
            setState({ count: 5 });
        });

        expect(result.current[0]).toEqual({ count: 5 });
    });

    it("passes initial props, and rerenders with the same or with new props", async () => {
        const { result } = await renderHook(() => "no props");
        expect(result.current).toBe("no props");
        const doubled = await renderHook(({ value }: { value: number }) => value * 2, { initialProps: { value: 5 } });
        expect(doubled.result.current).toBe(10);
        await doubled.rerender({ value: 25 });
        expect(doubled.result.current).toBe(50);

        const counted = await renderHook(() => {
            const ref = useRef(0);
            ref.current += 1;

            return ref.current;
        });

        expect(counted.result.current).toBe(1);
        await counted.rerender();
        expect(counted.result.current).toBe(2);
    });
});

describe("renderHook (2)", () => {
    it("preserves state, memoized callbacks and refs across rerenders", async () => {
        const counter = await renderHook(({ initial }: { initial: number }) => useCounter(initial), {
            initialProps: { initial: 10 },
        });

        await act(() => {
            counter.result.current.increment();
        });

        expect(counter.result.current.count).toBe(11);

        await act(() => {
            counter.result.current.decrement();
        });

        expect(counter.result.current.count).toBe(10);

        const memo = await renderHook(({ value }: { value: number }) => useCallback(() => value, [value]), {
            initialProps: { value: 1 },
        });

        const first = memo.result.current;
        expect(first()).toBe(1);
        await memo.rerender({ value: 2 });
        expect(memo.result.current()).toBe(2);
        expect(memo.result.current).not.toBe(first);
    });
});

describe("renderHook (3)", () => {
    it("runs and cleans up effects on every prop change and on unmount", async () => {
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

    it("applies a wrapper so the hook can read context from it", async () => {
        const Ctx = createContext<string>("default");
        const rendered = { didRenderWrapper: false };

        const ContextWrapper = ({ children }: { children: ReactNode }): ReactNode => {
            useLayoutEffect(() => {
                rendered.didRenderWrapper = true;
            });

            return <Ctx.Provider value="from-wrapper">{children}</Ctx.Provider>;
        };

        const { result } = await renderHook(() => useContext(Ctx), { wrapper: ContextWrapper });
        expect(rendered.didRenderWrapper).toBe(true);
        expect(result.current).toBe("from-wrapper");
    });
});

describe("renderHook (4)", () => {
    it("throws when the hook throws on the first render and on a rerender", async () => {
        await expect(renderHook(errorHook)).rejects.toThrow();
        let shouldThrow = false;

        const { result, rerender } = await renderHook(() => {
            if (shouldThrow) {
                throw new Error("Rerender error");
            }

            return "ok";
        });

        expect(result.current).toBe("ok");
        shouldThrow = true;
        await expect(rerender()).rejects.toThrow();
    });
});
