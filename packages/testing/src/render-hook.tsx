import { useRef } from "react";
import { render } from "./render.js";
import type { RenderHookOptions, RenderHookResult } from "./types.js";

/**
 * Renders a React hook for testing.
 *
 * Creates a test component that executes the hook and provides utilities
 * for accessing the result, re-rendering with new props, and cleanup.
 *
 * @param callback - Function that calls the hook and returns its result
 * @param options - Render options including initialProps and wrapper
 * @returns A promise resolving to the hook result and utilities
 *
 * @example
 * ```tsx
 * import { renderHook } from "@gtkx/testing";
 * import { useState } from "react";
 *
 * test("useState hook", async () => {
 *   const { result } = await renderHook(() => useState(0));
 *   expect(result.current[0]).toBe(0);
 * });
 * ```
 *
 * @example
 * ```tsx
 * import { renderHook } from "@gtkx/testing";
 *
 * test("hook with props", async () => {
 *   const { result, rerender } = await renderHook(
 *     ({ multiplier }) => useMultiplier(multiplier),
 *     { initialProps: { multiplier: 2 } }
 *   );
 *
 *   expect(result.current).toBe(2);
 *
 *   await rerender({ multiplier: 3 });
 *   expect(result.current).toBe(3);
 * });
 * ```
 */
export const renderHook = async <Result, Props>(
    callback: (props: Props) => Result,
    options?: RenderHookOptions<Props>,
): Promise<RenderHookResult<Result, Props>> => {
    const resultRef = { current: undefined as Result };
    let currentProps = options?.initialProps as Props;

    const TestComponent = ({ props }: { props: Props }): null => {
        const result = callback(props);
        const ref = useRef(resultRef);
        ref.current.current = result;
        return null;
    };

    const renderResult = await render(<TestComponent props={currentProps} />, {
        wrapper: options?.wrapper ?? false,
    });

    return {
        result: resultRef,
        rerender: async (newProps?: Props) => {
            if (newProps !== undefined) {
                currentProps = newProps;
            }
            await renderResult.rerender(<TestComponent props={currentProps} />);
        },
        unmount: renderResult.unmount,
    };
};
