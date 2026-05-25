import { GtkApplicationWindow } from "@gtkx/react";
import { useRef } from "react";
import { render } from "./render.js";
import type { RenderHookOptions, RenderHookResult, WrapperComponent } from "./types.js";

const composeWithDefaultHost = (userWrapper: boolean | WrapperComponent | undefined): WrapperComponent | false => {
    if (userWrapper === false) return false;
    if (userWrapper === true || userWrapper === undefined) {
        return ({ children }) => (
            <GtkApplicationWindow defaultWidth={800} defaultHeight={600}>
                {children}
            </GtkApplicationWindow>
        );
    }
    const InnerWrapper = userWrapper;
    return ({ children }) => (
        <GtkApplicationWindow defaultWidth={800} defaultHeight={600}>
            <InnerWrapper>{children}</InnerWrapper>
        </GtkApplicationWindow>
    );
};

/**
 * Renders a React hook for testing.
 *
 * Creates a test component that executes the hook and provides utilities
 * for accessing the result, re-rendering with new props, and cleanup.
 *
 * When the hook callback takes props, `initialProps` is required at the
 * type level. When it takes none, `options` may be omitted entirely.
 *
 * A host `GtkApplicationWindow` is always provided so the hook tree has a
 * widget root. A custom `wrapper` is composed *inside* the host, which lets
 * tests pass pure context-provider wrappers without having to provide their
 * own window.
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
 *
 * @example
 * ```tsx
 * const Wrapper = ({ children }) => (
 *   <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
 * );
 *
 * test("hook with context", async () => {
 *   const { result } = await renderHook(() => useTheme(), { wrapper: Wrapper });
 *   expect(result.current).toBe("dark");
 * });
 * ```
 */
export function renderHook<Result>(
    callback: () => Result,
    options?: RenderHookOptions<undefined>,
): Promise<RenderHookResult<Result, undefined>>;
export function renderHook<Result, Props>(
    callback: (props: Props) => Result,
    options: RenderHookOptions<Props>,
): Promise<RenderHookResult<Result, Props>>;
export async function renderHook<Result, Props>(
    callback: (props: Props) => Result,
    options?: RenderHookOptions<Props>,
): Promise<RenderHookResult<Result, Props>> {
    const composedWrapper = composeWithDefaultHost(options?.wrapper);
    const initialProps = (options as { initialProps?: Props } | undefined)?.initialProps as Props;
    const resultRef: { current: Result | undefined } = { current: undefined };
    let currentProps: Props = initialProps;

    const TestComponent = ({ props }: { props: Props }): null => {
        const result = callback(props);
        const ref = useRef(resultRef);
        ref.current.current = result;
        return null;
    };

    const renderResult = await render(<TestComponent props={currentProps} />, { wrapper: composedWrapper });

    return {
        result: resultRef as { current: Result },
        rerender: async (newProps?: Props) => {
            if (newProps !== undefined) {
                currentProps = newProps;
            }
            await renderResult.rerender(<TestComponent props={currentProps} />);
        },
        unmount: renderResult.unmount,
    };
}
